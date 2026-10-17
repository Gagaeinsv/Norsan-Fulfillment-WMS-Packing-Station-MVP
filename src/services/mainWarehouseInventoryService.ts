import { Product } from "../types/wms";
import { getProductLotInfo, updateProductLotInfo } from "./lotTraceabilityService";

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

const STORAGE_KEY = "wms_main_inventory_v1";

const DEFAULT_STOCK_BY_SKU: Record<string, Omit<WarehouseStockRecord, "sku">> = {
  "NOR-TOT-200-LEM": {
    palletZone: "PALLET-A1",
    unitsPerCarton: 20,
    closedCartonsOnPallet: 38, // 760 pz
    openUnitsOnPackingShelf: 24, // Tot: 784 pz
    erpExpectedTotalUnits: 784,
    monthlySalesVelocity: 420,
    unitCostEur: 26.0,
    lastCountedAt: "Oggi, 08:30",
  },
  "NOR-VEG-100-LEM": {
    palletZone: "PALLET-A2",
    unitsPerCarton: 12,
    closedCartonsOnPallet: 14, // 168 pz
    openUnitsOnPackingShelf: 10, // Tot: 178 pz
    erpExpectedTotalUnits: 180, // -2 pz discrepancy (es. omaggio/rottura non scaricata)
    monthlySalesVelocity: 110,
    unitCostEur: 29.0,
    lastCountedAt: "Ieri, 17:15",
  },
  "NOR-ARK-200-LEM": {
    palletZone: "PALLET-A3",
    unitsPerCarton: 20,
    closedCartonsOnPallet: 22, // 440 pz
    openUnitsOnPackingShelf: 16, // Tot: 456 pz
    erpExpectedTotalUnits: 456,
    monthlySalesVelocity: 190,
    unitCostEur: 27.0,
    lastCountedAt: "Oggi, 08:30",
  },
  "NOR-KID-OIL-150": {
    palletZone: "PALLET-B1",
    unitsPerCarton: 12,
    closedCartonsOnPallet: 18, // 216 pz
    openUnitsOnPackingShelf: 14, // Tot: 230 pz
    erpExpectedTotalUnits: 230,
    monthlySalesVelocity: 55, // ~4.2 mesi di scorta, ma scade a 12/2026 (2 mesi)! Rischio scadenza!
    unitCostEur: 22.5,
    lastCountedAt: "3 gg fa",
  },
  "NOR-TOT-200-NAT": {
    palletZone: "PALLET-A4",
    unitsPerCarton: 20,
    closedCartonsOnPallet: 16, // 320 pz
    openUnitsOnPackingShelf: 12, // Tot: 332 pz
    erpExpectedTotalUnits: 332,
    monthlySalesVelocity: 140,
    unitCostEur: 26.0,
    lastCountedAt: "Oggi, 08:30",
  },
  "NOR-VIT-D3K2-20": {
    palletZone: "PALLET-B2",
    unitsPerCarton: 24,
    closedCartonsOnPallet: 2, // 48 pz (Scorta pallet bassa!)
    openUnitsOnPackingShelf: 18, // Tot: 66 pz
    erpExpectedTotalUnits: 66,
    monthlySalesVelocity: 95,
    unitCostEur: 24.0,
    lastCountedAt: "Oggi, 09:00",
  },
};

let memoryInventory: Record<string, WarehouseStockRecord> = {};

function initDefaultRecord(product: Product): WarehouseStockRecord {
  const preset = DEFAULT_STOCK_BY_SKU[product.sku];
  if (preset) {
    return { sku: product.sku, ...preset };
  }

  let hash = 0;
  for (let i = 0; i < product.sku.length; i++) {
    hash = (hash * 31 + product.sku.charCodeAt(i)) % 500;
  }
  const unitsPerCarton = product.weightGrams >= 350 ? 20 : 24;
  const closedCartonsOnPallet = (hash % 12) + 6;
  const openUnitsOnPackingShelf = (hash % 10) + 8;
  const total = closedCartonsOnPallet * unitsPerCarton + openUnitsOnPackingShelf;
  const zonePrefix = product.brand === "ZREEN" ? "PALLET-Z" : "PALLET-C";

  return {
    sku: product.sku,
    palletZone: `${zonePrefix}${(hash % 6) + 1}`,
    unitsPerCarton,
    closedCartonsOnPallet,
    openUnitsOnPackingShelf,
    erpExpectedTotalUnits: total,
    monthlySalesVelocity: Math.max(35, (hash % 90) + 40),
    unitCostEur: product.brand === "ZREEN" ? 28.0 : 25.0,
    lastCountedAt: "Settimana scorsa",
  };
}

function loadInventoryMap(products: Product[]): Record<string, WarehouseStockRecord> {
  const base: Record<string, WarehouseStockRecord> = {};
  for (const p of products) {
    base[p.sku] = memoryInventory[p.sku] || initDefaultRecord(p);
  }

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
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
  if (!match) return 8;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  // Reference date: October 2026
  return Math.max(0, (year - 2026) * 12 + (month - 10));
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
    const maxSellableBeforeExpiry = Math.round(
      monthsUntilExpiry * rec.monthlySalesVelocity,
    );
    const writeOffRiskUnits = Math.max(0, physicalTotalUnits - maxSellableBeforeExpiry);
    const writeOffRiskEur = Math.round(writeOffRiskUnits * rec.unitCostEur);

    let stockHealth: EnrichedInventoryItem["stockHealth"] = "aligned";
    if (writeOffRiskUnits > 0) {
      stockHealth = "overstock_expiry_risk";
    } else if (discrepancyUnits !== 0) {
      stockHealth = "discrepancy";
    } else if (rec.closedCartonsOnPallet <= 3) {
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
      lastCountedAt: `Adesso (+${cartonsAdded} cartoni da Berlino)`,
    };
    saveInventoryMap(map);
    if (newLotNumber && newExpiryDate) {
      updateProductLotInfo(sku, newLotNumber, newExpiryDate);
    }
  }
  return getWarehouseInventory(products);
}
