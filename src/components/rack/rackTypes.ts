/**
 * rack/rackTypes.ts
 * Shared types, tier topology definition, and localStorage persistence helpers
 * for the StationRackGuide rack map feature.
 */

import { Product } from '../../types/wms';

export interface SlotOverride {
  productId: string;
  customPhotoUrl?: string;
  customCoordinate?: string;
  notes?: string;
}

export interface TierDef {
  id: 'NA' | 'NB' | 'A' | 'B' | 'C' | 'D' | 'E';
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

const STORAGE_KEY = 'wms_slot_overrides';

export function loadOverrides(): Record<string, SlotOverride> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveOverrides(data: Record<string, SlotOverride>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function buildSlotCoordinate(tier: TierDef, index: number): string {
  if (tier.isNorsan) return `${tier.prefix}${index}`;
  return `${tier.prefix}${String(index).padStart(2, '0')}`;
}

export const TIERS: TierDef[] = [
  { id: 'NA', label: 'N-A (1..8)', sublabel: 'Polica NORSAN — Oli & Flaconi vetro', color: 'ring-cyan-400', headerBg: 'bg-cyan-50 border-cyan-300', count: 8, prefix: 'N-A', isNorsan: true },
  { id: 'NB', label: 'N-B (1..3) — TAVOLO', sublabel: 'Fast-Pick Buffer: scatole aperte sul tavolo davanti', color: 'ring-violet-400', headerBg: 'bg-violet-50 border-violet-300', count: 3, prefix: 'N-B', isNorsan: true, isFastBuffer: true },
  { id: 'A',  label: 'Tier A (01..24)', sublabel: 'ZREEN — Rack alto (24 slot)', color: 'ring-emerald-400', headerBg: 'bg-emerald-50 border-emerald-300', count: 24, prefix: 'A-' },
  { id: 'B',  label: 'Tier B (01..24)', sublabel: 'ZREEN — Rack medio-alto (24 slot)', color: 'ring-green-400', headerBg: 'bg-green-50 border-green-300', count: 24, prefix: 'B-' },
  { id: 'C',  label: 'Tier C (01..15)', sublabel: 'ZREEN — Rack medio (15 slot)', color: 'ring-yellow-400', headerBg: 'bg-yellow-50 border-yellow-300', count: 15, prefix: 'C-' },
  { id: 'D',  label: 'Tier D (01..38)', sublabel: 'ZREEN — Rack basso P2L, 38 slot', color: 'ring-orange-400', headerBg: 'bg-orange-50 border-orange-300', count: 38, prefix: 'D-' },
  { id: 'E',  label: 'Tier E — Pavimento / Riserva Sfuso', sublabel: 'Stock di riserva e pallet floor — non picking diretto', color: 'ring-slate-300', headerBg: 'bg-slate-50 border-slate-200', count: 0, prefix: 'E-', isFloor: true },
];

// Re-export Product for convenience (used in slot cell and edit panel)
export type { Product };
