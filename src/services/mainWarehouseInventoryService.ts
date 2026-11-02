import { Product } from "../types/wms";
import {
  getProductLotInfo,
  updateProductLotInfo,
  hydrateLotsFromServer,
} from "./lotTraceabilityService";
import {
  fetchInventoryAndLotsApi,
  upsertInventoryRecordApi,
} from "./api";

export interface WarehouseStockRecord {
  sku: string;
  palletZone: string;
  unitsPerCarton: number;
  closedCartonsOnPallet: number;
  openUnitsOnPackingShelf: number;
  erpExpectedTotalUnits: number;
  monthlySalesVelocity: number;
  unitCostEur: number;
  lastCountedAt: string;
}

export interface EnrichedInventoryItem extends WarehouseStockRecord {
  product: Product;
  lotNumber: string;
  expiryDate: string;
  physicalTotalUnits: number;
  discrepancyUnits: number;
  monthsUntilExpiry: number;
  monthsOfStockRemaining: number;
  writeOffRiskUnits: number;
  writeOffRiskEur: number;
  stockHealth: "aligned" | "discrepancy" | "overstock_expiry_risk" | "low_pallet_stock";
}

const STORAGE_KEY = "wms_inventory_prod_v1";
const LEGACY_STORAGE_KEY = "wms_main_inventory_v1";

// Production mode: no fake/test stock preloaded.
// All SKUs start at 0 until physical cycle count or inbound reception is recorded.
const DEFAULT_STOCK_BY_SKU: Record<string, Omit<WarehouseStockRecord, "sku">> = {};

let memoryInventory: Record<string, WarehouseStockRecord> = {};

function initDefaultRecord(product: Product): WarehouseStockRecord {
  const preset = DEFAULT_STOCK_BY_SKU[product.sku];
  if (preset) {
    return { sku: product.sku, ...preset };
  }

  const unitsPerCarton = product.weightGrams >= 350 ? 20 : 24;
  const zonePrefix = product.brand === "ZREEN" ? "PALLET-Z" : "PALLET-N";

  return {
    sku: product.sku,
    palletZone: `${zonePrefix}-${product.shelfLocation || "01"}`,
    unitsPerCarton,
    closedCartonsOnPallet: 0,
    openUnitsOnPackingShelf: 0,
    erpExpectedTotalUnits: 0,
    monthlySalesVelocity: 0,
    unitCostEur: product.brand === "ZREEN" ? 28.0 : 25.0,
    lastCountedAt: "Non conteggiato",
  };
}

function loadInventoryMap(products: Product[]): Record<string, WarehouseStockRecord> {
  const base: Record<string, WarehouseStockRecord> = {};
  for (const p of products) {
    base[p.sku] = memoryInventory[p.sku] || initDefaultRecord(p);
  }

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      // Remove legacy mock inventory cache if present
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const k of Object.keys(parsed)) {
          base[k] = { ...base[k], ...parsed[k] };
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  memoryInventory = { ...base };
  return base;
}

function saveInventoryMap(map: Record<string, WarehouseStockRecord>) {
  memoryInventory = { ...map };
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function computeMonthsUntilExpiry(expiryDate: string): number {
  const match = expiryDate.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return 0;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return Math.max(0, (year - currentYear) * 12 + (month - currentMonth));
}

export function getWarehouseInventory(products: Product[]): EnrichedInventoryItem[] {
  const map = loadInventoryMap(products);

  return products.map((product) => {
    const rec = map[product.sku] || initDefaultRecord(product);
    const lotInfo = getProductLotInfo(product);
    const physicalTotalUnits =
      rec.closedCartonsOnPallet * rec.unitsPerCarton + rec.openUnitsOnPackingShelf;
    const discrepancyUnits = physicalTotalUnits - rec.erpExpectedTotalUnits;
    const monthsUntilExpiry = computeMonthsUntilExpiry(lotInfo.expiryDate);
    const monthsOfStockRemaining =
      rec.monthlySalesVelocity > 0
        ? Number((physicalTotalUnits / rec.monthlySalesVelocity).toFixed(1))
        : 0;

    // Units that won't sell before expiry date at current monthly velocity
    const maxSellableBeforeExpiry =
      rec.monthlySalesVelocity > 0
        ? Math.round(monthsUntilExpiry * rec.monthlySalesVelocity)
        : physicalTotalUnits;
    const writeOffRiskUnits =
      rec.monthlySalesVelocity > 0 && monthsUntilExpiry > 0
        ? Math.max(0, physicalTotalUnits - maxSellableBeforeExpiry)
        : 0;
    const writeOffRiskEur = Math.round(writeOffRiskUnits * rec.unitCostEur);

    let stockHealth: EnrichedInventoryItem["stockHealth"] = "aligned";
    if (writeOffRiskUnits > 0) {
      stockHealth = "overstock_expiry_risk";
    } else if (discrepancyUnits !== 0) {
      stockHealth = "discrepancy";
    } else if (
      (rec.erpExpectedTotalUnits > 0 || rec.lastCountedAt !== "Non conteggiato") &&
      rec.closedCartonsOnPallet <= 3 &&
      physicalTotalUnits > 0
    ) {
      stockHealth = "low_pallet_stock";
    }

    return {
      ...rec,
      product,
      lotNumber: lotInfo.lotNumber,
      expiryDate: lotInfo.expiryDate,
      physicalTotalUnits,
      discrepancyUnits,
      monthsUntilExpiry,
      monthsOfStockRemaining,
      writeOffRiskUnits,
      writeOffRiskEur,
      stockHealth,
    };
  });
}

export function recordPhysicalCount(
  products: Product[],
  sku: string,
  closedCartonsOnPallet: number,
  openUnitsOnPackingShelf: number,
  alignErp = false,
): EnrichedInventoryItem[] {
  const map = loadInventoryMap(products);
  const existing = map[sku];
  if (existing) {
    const newTotal =
      Math.max(0, closedCartonsOnPallet) * existing.unitsPerCarton +
      Math.max(0, openUnitsOnPackingShelf);
    map[sku] = {
      ...existing,
      closedCartonsOnPallet: Math.max(0, closedCartonsOnPallet),
      openUnitsOnPackingShelf: Math.max(0, openUnitsOnPackingShelf),
      erpExpectedTotalUnits: alignErp ? newTotal : existing.erpExpectedTotalUnits,
      lastCountedAt: "Adesso (Verificato)",
    };
    saveInventoryMap(map);
    upsertInventoryRecordApi(map[sku]).catch(() => {});
  }
  return getWarehouseInventory(products);
}

export function transferCartonsToPackingShelf(
  products: Product[],
  sku: string,
  cartonsToMove = 1,
): EnrichedInventoryItem[] {
  const map = loadInventoryMap(products);
  const existing = map[sku];
  if (existing && existing.closedCartonsOnPallet >= cartonsToMove) {
    map[sku] = {
      ...existing,
      closedCartonsOnPallet: existing.closedCartonsOnPallet - cartonsToMove,
      openUnitsOnPackingShelf:
        existing.openUnitsOnPackingShelf + cartonsToMove * existing.unitsPerCarton,
      lastCountedAt: "Adesso (Kanban Pallet → Scaffale)",
    };
    saveInventoryMap(map);
    upsertInventoryRecordApi(map[sku]).catch(() => {});
  }
  return getWarehouseInventory(products);
}

export function receiveInboundPallet(
  products: Product[],
  sku: string,
  cartonsAdded: number,
  newLotNumber?: string,
  newExpiryDate?: string,
): EnrichedInventoryItem[] {
  const map = loadInventoryMap(products);
  const existing = map[sku];
  if (existing && cartonsAdded > 0) {
    const unitsAdded = cartonsAdded * existing.unitsPerCarton;
    map[sku] = {
      ...existing,
      closedCartonsOnPallet: existing.closedCartonsOnPallet + cartonsAdded,
      erpExpectedTotalUnits: existing.erpExpectedTotalUnits + unitsAdded,
      lastCountedAt: `Adesso (+${cartonsAdded} cartoni ricevuti)`,
    };
    saveInventoryMap(map);
    upsertInventoryRecordApi(map[sku]).catch(() => {});
    if (newLotNumber && newExpiryDate) {
      updateProductLotInfo(sku, newLotNumber, newExpiryDate);
    }
  }
  return getWarehouseInventory(products);
}

export function deductPackedOrderFromShelf(
  products: Product[],
  items: { sku: string; quantity: number }[],
): void {
  const map = loadInventoryMap(products);
  let changed = false;
  for (const it of items) {
    const existing = map[it.sku];
    if (existing && it.quantity > 0) {
      map[it.sku] = {
        ...existing,
        openUnitsOnPackingShelf: Math.max(
          0,
          existing.openUnitsOnPackingShelf - it.quantity,
        ),
        erpExpectedTotalUnits: Math.max(
          0,
          existing.erpExpectedTotalUnits - it.quantity,
        ),
      };
      changed = true;
      upsertInventoryRecordApi(map[it.sku]).catch(() => {});
    }
  }
  if (changed) {
    saveInventoryMap(map);
  }
}

export async function syncInventoryFromBackend(
  products: Product[],
): Promise<boolean> {
  const data = await fetchInventoryAndLotsApi();
  if (!data) return false;

  if (Array.isArray(data.lots) && data.lots.length > 0) {
    hydrateLotsFromServer(data.lots);
  }

  if (Array.isArray(data.stock) && data.stock.length > 0) {
    const map = loadInventoryMap(products);
    for (const r of data.stock) {
      if (!r.sku) continue;
      map[r.sku] = {
        sku: r.sku,
        palletZone: r.pallet_zone || map[r.sku]?.palletZone || "PALLET-01",
        unitsPerCarton: r.units_per_carton ?? map[r.sku]?.unitsPerCarton ?? 20,
        closedCartonsOnPallet: r.closed_cartons_on_pallet ?? 0,
        openUnitsOnPackingShelf: r.open_units_on_packing_shelf ?? 0,
        erpExpectedTotalUnits: r.erp_expected_total_units ?? 0,
        monthlySalesVelocity: r.monthly_sales_velocity ?? 0,
        unitCostEur: r.unit_cost_eur ?? 25.0,
        lastCountedAt: r.last_counted_at || "Non conteggiato",
      };
    }
    saveInventoryMap(map);
  }
  return true;
}
