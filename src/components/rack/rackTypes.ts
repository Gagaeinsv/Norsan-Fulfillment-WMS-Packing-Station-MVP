/**
 * rack/rackTypes.ts
 * Shared types, tier topology definition, and localStorage persistence helpers
 * for the StationRackGuide rack map feature.
 */

import { Product } from "../../types/wms";

export interface SlotOverride {
  productId: string;
  customPhotoUrl?: string;
  customCoordinate?: string;
  notes?: string;
}

export interface TierDef {
  id: "NA" | "NB" | "A" | "B" | "C" | "D" | "E";
  label: string;
  sublabel: string;
  color: string;
  headerBg: string;
  count: number;
  prefix: string;
  isNorsan?: boolean;
  isFastBuffer?: boolean;
  isFloor?: boolean;
}

const STORAGE_KEY = "wms_slot_overrides";

export function loadOverrides(): Record<string, SlotOverride> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveOverrides(data: Record<string, SlotOverride>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function buildSlotCoordinate(tier: TierDef, index: number): string {
  if (tier.isNorsan) return `${tier.prefix}${index}`;
  return `${tier.prefix}${String(index).padStart(2, "0")}`;
}

export const TIERS: TierDef[] = [
  {
    id: "NA",
    label: "N-A (1..8)",
    sublabel: "Polica NORSAN — Oli & Flaconi vetro",
    color: "ring-cyan-400",
    headerBg: "bg-cyan-50 border-cyan-300",
    count: 8,
    prefix: "N-A",
    isNorsan: true,
  },
  {
    id: "NB",
    label: "N-B (1..3) — TAVOLO",
    sublabel: "Fast-Pick Buffer: scatole aperte sul tavolo davanti",
    color: "ring-violet-400",
    headerBg: "bg-violet-50 border-violet-300",
    count: 3,
    prefix: "N-B",
    isNorsan: true,
    isFastBuffer: true,
  },
  {
    id: "A",
    label: "Tier A (01..24)",
    sublabel: "ZREEN — Rack alto (24 slot)",
    color: "ring-emerald-400",
    headerBg: "bg-emerald-50 border-emerald-300",
    count: 24,
    prefix: "A-",
  },
  {
    id: "B",
    label: "Tier B (01..24)",
    sublabel: "ZREEN — Rack medio-alto (24 slot)",
    color: "ring-green-400",
    headerBg: "bg-green-50 border-green-300",
    count: 24,
    prefix: "B-",
  },
  {
    id: "C",
    label: "Tier C (01..15)",
    sublabel: "ZREEN — Rack medio (15 slot)",
    color: "ring-yellow-400",
    headerBg: "bg-yellow-50 border-yellow-300",
    count: 15,
    prefix: "C-",
  },
  {
    id: "D",
    label: "Tier D (01..38)",
    sublabel: "ZREEN — Rack basso P2L, 38 slot",
    color: "ring-orange-400",
    headerBg: "bg-orange-50 border-orange-300",
    count: 38,
    prefix: "D-",
  },
  {
    id: "E",
    label: "Tier E — Pavimento / Riserva Sfuso",
    sublabel: "Stock di riserva e pallet floor — non picking diretto",
    color: "ring-slate-300",
    headerBg: "bg-slate-50 border-slate-200",
    count: 0,
    prefix: "E-",
    isFloor: true,
  },
];

// Re-export Product for convenience (used in slot cell and edit panel)
export type { Product };

export interface WarehouseSlotData {
  slot_code: string;
  side: "S" | "D";
  tier: 1 | 2 | 3;
  tier_id?: "NA" | "NB" | "A" | "B" | "C" | "D" | "E";
  description: string;
  product_id?: string | null;
  product_name?: string | null;
  product_italian_name?: string | null;
  product_ean?: string | null;
  product_brand?: string | null;
  product_volume?: string | null;
  product_image_url?: string | null;
  is_p2l?: boolean;
  p2l_led_index?: number;
}

/**
 * Generates the complete 5-tier Bolzano Hub warehouse slots (NORSAN N-A/N-B + ZREEN Tiers A/B/C/D).
 * Automatically maps products according to shelfCoordinate or shelfLocation.
 */
export function generateBolzanoDefaultSlots(products: Product[]): WarehouseSlotData[] {
  const result: WarehouseSlotData[] = [];
  const productMap = new Map<string, Product>();

  products.forEach((p) => {
    const coord = p.shelfCoordinate || p.shelfLocation;
    if (coord) {
      productMap.set(coord.toUpperCase(), p);
    }
  });

  TIERS.forEach((tier) => {
    if (tier.isFloor) return;
    for (let i = 1; i <= tier.count; i++) {
      const slotCode = buildSlotCoordinate(tier, i);
      const prod = productMap.get(slotCode.toUpperCase());
      const numericTier: 1 | 2 | 3 =
        tier.id === "D"
          ? 1
          : tier.id === "NA" || tier.id === "NB" || tier.id === "C"
            ? 2
            : 3;

      result.push({
        slot_code: slotCode,
        side: tier.isNorsan ? "S" : "D",
        tier: numericTier,
        tier_id: tier.id,
        description: `${tier.label} - Slot ${slotCode}`,
        product_id: prod?.id || null,
        product_name: prod?.name || null,
        product_italian_name: prod?.italianName || null,
        product_ean: prod?.ean || null,
        product_brand: prod?.brand || (tier.isNorsan ? "NORSAN" : "ZREEN"),
        product_volume: prod?.volume || null,
        product_image_url: prod?.imageUrl || null,
        is_p2l: tier.id === "D",
        p2l_led_index: tier.id === "D" ? i : undefined,
      });
    }
  });

  return result;
}
