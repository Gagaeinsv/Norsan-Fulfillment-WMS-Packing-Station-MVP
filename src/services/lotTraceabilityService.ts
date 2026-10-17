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

const STORAGE_KEY = "wms_shelf_lots_v1";

const DEFAULT_PRIORITY_LOTS: Record<string, ProductLotInfo> = {
  "NOR-TOT-200-LEM": {
    sku: "NOR-TOT-200-LEM",
    lotNumber: "L2604N",
    expiryDate: "12/2026",
    secondaryLot: {
      lotNumber: "L2609N",
      expiryDate: "06/2027",
    },
    fefoStatus: "fefo_priority",
    fefoNote: "FEFO Attivo: Esaurire prima cartone frontale L2604N (Scad. 12/2026)",
  },
  "NOR-VEG-100-LEM": {
    sku: "NOR-VEG-100-LEM",
    lotNumber: "L2602V",
    expiryDate: "11/2026",
    secondaryLot: {
      lotNumber: "L2608V",
      expiryDate: "05/2027",
    },
    fefoStatus: "expiring_soon",
    fefoNote: "Priorità FEFO Alta: Scadenza ravvicinata (11/2026) — prelevare fila anteriore",
  },
  "NOR-ARK-200-LEM": {
    sku: "NOR-ARK-200-LEM",
    lotNumber: "L2607A",
    expiryDate: "07/2027",
    secondaryLot: {
      lotNumber: "L2610A",
      expiryDate: "10/2027",
    },
    fefoStatus: "optimal",
  },
  "NOR-TOT-200-NAT": {
    sku: "NOR-TOT-200-NAT",
    lotNumber: "L2605T",
    expiryDate: "04/2027",
    fefoStatus: "optimal",
  },
  "NOR-KID-OIL-150": {
    sku: "NOR-KID-OIL-150",
    lotNumber: "L2603K",
    expiryDate: "12/2026",
    secondaryLot: {
      lotNumber: "L2609K",
      expiryDate: "08/2027",
    },
    fefoStatus: "fefo_priority",
    fefoNote: "FEFO Kids: Prelevare prima L2603K (Scad. 12/2026)",
  },
  "NOR-VIT-D3K2-20": {
    sku: "NOR-VIT-D3K2-20",
    lotNumber: "L2606D",
    expiryDate: "09/2027",
    fefoStatus: "optimal",
  },
};

let memoryLots: Record<string, ProductLotInfo> = { ...DEFAULT_PRIORITY_LOTS };

function loadSavedLots(): Record<string, ProductLotInfo> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { ...memoryLots };
  }
  try {
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
  // Reference date: October 2026
  const monthsRemaining = (year - 2026) * 12 + (month - 10);
  if (monthsRemaining <= 2) return "expiring_soon";
  if (monthsRemaining <= 4 || hasSecondaryLot) return "fefo_priority";
  return "optimal";
}

export function getProductLotInfo(product: Product): ProductLotInfo {
  const map = loadSavedLots();
  if (map[product.sku]) {
    return map[product.sku];
  }

  // Deterministic realistic lot based on product SKU/ID
  let hash = 0;
  for (let i = 0; i < product.sku.length; i++) {
    hash = (hash * 31 + product.sku.charCodeAt(i)) % 900;
  }
  const prefix = product.brand === "ZREEN" ? "Z" : "N";
  const monthNum = ((hash % 8) + 3).toString().padStart(2, "0"); // 03..10
  const lotNumber = `L26${monthNum}${prefix}${String((hash % 89) + 10)}`;
  const expiryDate = `${monthNum}/2027`;

  return {
    sku: product.sku,
    lotNumber,
    expiryDate,
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
    lotNumber: cleanLot,
    expiryDate: cleanExp,
    secondaryLot: existing?.secondaryLot,
    fefoStatus: status,
    fefoNote:
      fefoNote !== undefined
        ? fefoNote
        : status === "expiring_soon"
        ? `Priorità FEFO Alta: Scadenza ravvicinata (${cleanExp})`
        : undefined,
  };

  map[sku] = updated;
  saveLots(map);
  return updated;
}

export function rotateToSecondaryLot(product: Product): ProductLotInfo {
  const current = getProductLotInfo(product);
  if (!current.secondaryLot) return current;

  const map = loadSavedLots();
  const promoted: ProductLotInfo = {
    sku: product.sku,
    lotNumber: current.secondaryLot.lotNumber,
    expiryDate: current.secondaryLot.expiryDate,
    fefoStatus: computeFefoStatus(current.secondaryLot.expiryDate, false),
    fefoNote: `Lotto precedente (${current.lotNumber}) esaurito • Attivo nuovo lotto ${current.secondaryLot.lotNumber}`,
  };
  map[product.sku] = promoted;
  saveLots(map);
  return promoted;
}
