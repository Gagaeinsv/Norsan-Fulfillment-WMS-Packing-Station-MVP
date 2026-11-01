import { Product } from "../types/wms";

export interface ProductLotInfo {
  sku: string;
  lotNumber: string;
  expiryDate: string; // MM/YYYY e.g. "12/2026"
  secondaryLot?: {
    lotNumber: string;
    expiryDate: string;
  };
  fefoStatus: "optimal" | "fefo_priority" | "expiring_soon";
  fefoNote?: string;
}

const STORAGE_KEY = "wms_lots_prod_v1";
const LEGACY_STORAGE_KEY = "wms_shelf_lots_v1";

// Production mode: no fake/demo lots preloaded.
// Lots are assigned when receiving pallets or updating shelf FEFO data.
const DEFAULT_PRIORITY_LOTS: Record<string, ProductLotInfo> = {};

let memoryLots: Record<string, ProductLotInfo> = { ...DEFAULT_PRIORITY_LOTS };

function loadSavedLots(): Record<string, ProductLotInfo> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { ...memoryLots };
  }
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...memoryLots };
    return { ...memoryLots, ...JSON.parse(raw) };
  } catch {
    return { ...memoryLots };
  }
}

function saveLots(map: Record<string, ProductLotInfo>) {
  memoryLots = { ...map };
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function computeFefoStatus(
  expiryDate: string,
  hasSecondaryLot: boolean,
): "optimal" | "fefo_priority" | "expiring_soon" {
  const match = expiryDate.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return hasSecondaryLot ? "fefo_priority" : "optimal";
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthsRemaining = (year - currentYear) * 12 + (month - currentMonth);
  if (monthsRemaining <= 2) return "expiring_soon";
  if (monthsRemaining <= 4 || hasSecondaryLot) return "fefo_priority";
  return "optimal";
}

export function getProductLotInfo(product: Product): ProductLotInfo {
  const map = loadSavedLots();
  if (map[product.sku]) {
    return map[product.sku];
  }

  return {
    sku: product.sku,
    lotNumber: "NON ASSEGNATO",
    expiryDate: "--/----",
    fefoStatus: "optimal",
  };
}

export function updateProductLotInfo(
  sku: string,
  lotNumber: string,
  expiryDate: string,
  fefoNote?: string,
): ProductLotInfo {
  const map = loadSavedLots();
  const existing = map[sku];
  const cleanLot = lotNumber.trim().toUpperCase();
  const cleanExp = expiryDate.trim();
  const status = computeFefoStatus(cleanExp, false);

  const updated: ProductLotInfo = {
    sku,
    lotNumber: cleanLot || "NON ASSEGNATO",
    expiryDate: cleanExp || "--/----",
    secondaryLot: existing?.secondaryLot,
    fefoStatus: status,
    fefoNote:
      fefoNote !== undefined
        ? fefoNote
        : status === "expiring_soon"
          ? `Priorità FEFO Alta: Scadenza ravvicinata (${cleanExp}) — esaurire per primo`
          : undefined,
  };

  map[sku] = updated;
  saveLots(map);
  return updated;
}

export function rotateToSecondaryLot(productOrSku: Product | string): ProductLotInfo {
  const sku = typeof productOrSku === "string" ? productOrSku : productOrSku.sku;
  const map = loadSavedLots();
  const existing = map[sku];
  if (!existing || !existing.secondaryLot) {
    return (
      existing || {
        sku,
        lotNumber: "NON ASSEGNATO",
        expiryDate: "--/----",
        fefoStatus: "optimal",
      }
    );
  }

  const promoted: ProductLotInfo = {
    sku,
    lotNumber: existing.secondaryLot.lotNumber,
    expiryDate: existing.secondaryLot.expiryDate,
    secondaryLot: undefined,
    fefoStatus: computeFefoStatus(existing.secondaryLot.expiryDate, false),
    fefoNote: `Lotto anteriore (${existing.lotNumber}) esaurito — ora attivo lotto ${existing.secondaryLot.lotNumber}`,
  };

  map[sku] = promoted;
  saveLots(map);
  return promoted;
}

export function resetAllShelfLots(): void {
  memoryLots = {};
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
