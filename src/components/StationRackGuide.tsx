/**
 * StationRackGuide.tsx — Mappa Scaffalature 5-Tier Hub Bolzano
 *
 * Topologia reale del magazzino:
 *   NORSAN side shelf: N-A (8 slot) + N-B (3 slot fast-pick buffer sul tavolo)
 *   ZREEN shared rack:
 *     Tier A: 24 slot  (A-01 … A-24)
 *     Tier B: 24 slot  (B-01 … B-24)
 *     Tier C: 15 slot  (C-01 … C-15)
 *     Tier D: 38 slot  (D-01 … D-38)
 *     Tier E: floor reserve (bulk stock)
 *
 * Modalità LEAD (isTeamLead=true):
 *   - Ogni slot ha pulsante "✏️ Modifica" che apre pannello di editing
 *   - L'editor permette di: cambiare shelfCoordinate, caricare foto prodotto
 *   - Le modifiche vengono salvate in localStorage (persistenti tra sessioni)
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  X, MapPin, Sparkles, CheckCircle2, ArrowLeftRight,
  Pencil, Camera, Save, RotateCcw, Package, ChevronDown, ChevronRight,
  AlertTriangle, Layers
} from 'lucide-react';
import { NORSAN_PRODUCTS, MARKETING_FLYERS } from '../data/norsanProducts';
import { Order, Product } from '../types/wms';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotOverride {
  productId: string;
  customPhotoUrl?: string;    // base64 data URL or object URL
  customCoordinate?: string;  // user-editable shelf coordinate
  notes?: string;
}

interface StationRackGuideProps {
  activeOrder: Order | null;
  stationConfigId: string;
  isTeamLead: boolean;
  onClose: () => void;
  onSimulateScan: (ean: string) => void;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'wms_slot_overrides';

function loadOverrides(): Record<string, SlotOverride> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveOverrides(data: Record<string, SlotOverride>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── Tier definitions (real warehouse topology) ───────────────────────────────

interface TierDef {
  id: 'NA' | 'NB' | 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  sublabel: string;
  color: string;          // tailwind ring color class
  headerBg: string;
  count: number;
  prefix: string;         // e.g. "A-" → A-01, A-02...
  isNorsan?: boolean;
  isFastBuffer?: boolean;
  isFloor?: boolean;
}

const TIERS: TierDef[] = [
  {
    id: 'NA',
    label: 'N-A (1..8)',
    sublabel: 'Polica NORSAN — Oli & Flaconi vetro',
    color: 'ring-cyan-400',
    headerBg: 'bg-cyan-50 border-cyan-300',
    count: 8,
    prefix: 'N-A',
    isNorsan: true,
  },
  {
    id: 'NB',
    label: 'N-B (1..3) — TAVOLO',
    sublabel: 'Fast-Pick Buffer: scatole aperte sul tavolo davanti',
    color: 'ring-violet-400',
    headerBg: 'bg-violet-50 border-violet-300',
    count: 3,
    prefix: 'N-B',
    isNorsan: true,
    isFastBuffer: true,
  },
  {
    id: 'A',
    label: 'Tier A (01..24)',
    sublabel: 'ZREEN — Rack alto (24 slot)',
    color: 'ring-emerald-400',
    headerBg: 'bg-emerald-50 border-emerald-300',
    count: 24,
    prefix: 'A-',
  },
  {
    id: 'B',
    label: 'Tier B (01..24)',
    sublabel: 'ZREEN — Rack medio-alto (24 slot)',
    color: 'ring-green-400',
    headerBg: 'bg-green-50 border-green-300',
    count: 24,
    prefix: 'B-',
  },
  {
    id: 'C',
    label: 'Tier C (01..15)',
    sublabel: 'ZREEN — Rack medio (15 slot)',
    color: 'ring-yellow-400',
    headerBg: 'bg-yellow-50 border-yellow-300',
    count: 15,
    prefix: 'C-',
  },
  {
    id: 'D',
    label: 'Tier D (01..38)',
    sublabel: 'ZREEN — Rack basso P2L, 38 slot',
    color: 'ring-orange-400',
    headerBg: 'bg-orange-50 border-orange-300',
    count: 38,
    prefix: 'D-',
  },
  {
    id: 'E',
    label: 'Tier E — Pavimento / Riserva Sfuso',
    sublabel: 'Stock di riserva e pallet floor — non picking diretto',
    color: 'ring-slate-300',
    headerBg: 'bg-slate-50 border-slate-200',
    count: 0,
    prefix: 'E-',
    isFloor: true,
  },
];

// ─── Slot coordinate builder ──────────────────────────────────────────────────

function buildSlotCoordinate(tier: TierDef, index: number): string {
  if (tier.isNorsan) {
    // N-A1..N-A8  or  N-B1..N-B3
    return `${tier.prefix}${index}`;
  }
  // A-01..A-24, D-01..D-38, etc.
  return `${tier.prefix}${String(index).padStart(2, '0')}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface EditPanelProps {
  product: Product;
  override: SlotOverride | undefined;
  onSave: (data: Partial<SlotOverride>) => void;
  onClose: () => void;
}

const EditPanel: React.FC<EditPanelProps> = ({ product, override, onSave, onClose }) => {
  const [coord, setCoord] = useState(override?.customCoordinate || product.shelfCoordinate || product.shelfLocation || '');
  const [notes, setNotes] = useState(override?.notes || '');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(override?.customPhotoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave({ customCoordinate: coord.trim() || undefined, notes: notes.trim() || undefined, customPhotoUrl: photoUrl });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border-2 border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-400" />
            <span className="font-black text-sm">Modifica Slot — Lead Only</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Product name (read-only) */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Prodotto</label>
            <div className="mt-1 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              {product.name}
              <span className="ml-2 text-xs font-mono text-slate-500">SKU: {product.sku}</span>
            </div>
          </div>

          {/* Shelf coordinate edit */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Coordinata Scaffale
            </label>
            <input
              type="text"
              value={coord}
              onChange={e => setCoord(e.target.value)}
              placeholder="es. D-38, N-A1, A-11..."
              className="mt-1 w-full border-2 border-slate-300 focus:border-amber-400 outline-none rounded-xl px-3 py-2 font-mono text-sm font-bold transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Note per il Packer
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="es. Attenzione: scatola fragile, posizionare in fondo..."
              className="mt-1 w-full border-2 border-slate-300 focus:border-amber-400 outline-none rounded-xl px-3 py-2 text-sm resize-none transition"
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Foto Prodotto / Slot
            </label>
            <div className="mt-1 flex gap-3 items-start">
              {photoUrl ? (
                <div className="relative">
                  <img
                    src={photoUrl}
                    alt="preview"
                    className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-400 shadow-sm"
                  />
                  <button
                    onClick={() => setPhotoUrl(undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition"
                >
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-[9px] text-slate-400 font-bold text-center">Carica<br/>foto</span>
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl transition border border-slate-300"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {photoUrl ? 'Cambia foto' : 'Carica foto'}
                </button>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Foto dello slot fisico o del prodotto. Visibile ai packer nella mappa.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Annulla
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm transition flex items-center justify-center gap-1.5 shadow-md"
          >
            <Save className="w-3.5 h-3.5" /> Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const StationRackGuide: React.FC<StationRackGuideProps> = ({
  activeOrder,
  stationConfigId,
  isTeamLead,
  onClose,
  onSimulateScan,
}) => {
  const [overrides, setOverrides] = useState<Record<string, SlotOverride>>(loadOverrides);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(
    new Set(['NA', 'NB', 'A', 'B', 'C', 'D'])
  );

  const isStation1 = stationConfigId === 'STATION_01';

  // Map productId → active order status
  const activeItemsMap = useMemo(() => {
    const m = new Map<string, { required: number; scanned: number; completed: boolean }>();
    if (activeOrder) {
      activeOrder.items.forEach(item => {
        m.set(item.product.id, {
          required: item.quantityRequired,
          scanned: item.quantityScanned,
          completed: item.quantityScanned >= item.quantityRequired,
        });
      });
    }
    return m;
  }, [activeOrder]);

  // Build lookup: shelfCoordinate → product
  const coordToProduct = useMemo(() => {
    const m = new Map<string, Product>();
    NORSAN_PRODUCTS.forEach(p => {
      const coord = overrides[p.id]?.customCoordinate || p.shelfCoordinate || p.shelfLocation;
      if (coord) m.set(coord, p);
    });
    return m;
  }, [overrides]);

  const toggleTier = useCallback((id: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSaveOverride = useCallback((product: Product, data: Partial<SlotOverride>) => {
    setOverrides(prev => {
      const next = { ...prev, [product.id]: { ...prev[product.id], productId: product.id, ...data } };
      saveOverrides(next);
      return next;
    });
  }, []);

  // ─── Slot cell renderer ────────────────────────────────────────────────────

  const renderSlot = useCallback((tier: TierDef, index: number) => {
    const coord = buildSlotCoordinate(tier, index);
    const product = coordToProduct.get(coord);
    const override = product ? overrides[product.id] : undefined;
    const activeInfo = product ? activeItemsMap.get(product.id) : undefined;
    const isNeeded = !!activeInfo && !activeInfo.completed;
    const isCompleted = !!activeInfo?.completed;
    const photoSrc = override?.customPhotoUrl || product?.imageUrl;

    let cellClass = 'border border-slate-200 bg-white text-slate-800';
    if (isNeeded) cellClass = 'border-2 border-amber-400 bg-amber-50 ring-2 ring-amber-400/30 shadow-md';
    else if (isCompleted) cellClass = 'border-2 border-emerald-500 bg-emerald-50 shadow-md';
    else if (tier.isFastBuffer) cellClass = 'border-2 border-violet-300 bg-violet-50/60';
    else if (!product) cellClass = 'border border-dashed border-slate-200 bg-slate-50/50 text-slate-400';

    return (
      <div
        key={coord}
        className={`relative rounded-xl p-2 flex flex-col gap-1 min-h-[100px] transition-all ${cellClass}`}
      >
        {/* Coordinate badge */}
        <div className="flex items-center justify-between gap-1">
          <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded border ${
            tier.isFastBuffer
              ? 'bg-violet-100 border-violet-300 text-violet-900'
              : tier.isNorsan
              ? 'bg-cyan-100 border-cyan-300 text-cyan-900'
              : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            {coord}
          </span>
          <div className="flex items-center gap-0.5">
            {isNeeded && (
              <span className="text-[8px] bg-amber-500 text-white font-black px-1 py-0.5 rounded-full flex items-center gap-0.5">
                <Sparkles className="w-2 h-2" /> SERVE
              </span>
            )}
            {isCompleted && (
              <span className="text-[8px] bg-emerald-600 text-white font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
                <CheckCircle2 className="w-2 h-2" /> OK
              </span>
            )}
            {tier.isFastBuffer && (
              <span className="text-[8px] bg-violet-600 text-white font-bold px-1 py-0.5 rounded-full">
                TAVOLO
              </span>
            )}
          </div>
        </div>

        {/* Product photo thumbnail */}
        {photoSrc && (
          <img
            src={photoSrc}
            alt={product?.name}
            className="w-full h-12 object-cover rounded-lg border border-slate-200"
          />
        )}

        {/* Product info */}
        {product ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="text-[10px] font-black text-slate-900 leading-tight line-clamp-2">
              {product.name}
            </div>
            {override?.notes && (
              <div className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 mt-0.5 leading-tight">
                ⚠ {override.notes}
              </div>
            )}
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[9px] text-slate-500 font-mono truncate max-w-[50px]">
                {product.ean}
              </span>
              <div className="flex items-center gap-0.5">
                {isTeamLead && (
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="p-0.5 rounded bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 transition"
                    title="Modifica posizione / foto"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                )}
                <button
                  onClick={() => onSimulateScan(product.ean)}
                  className="text-[9px] bg-slate-900 hover:bg-slate-700 text-white font-bold px-1.5 py-0.5 rounded transition"
                >
                  Scan
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <Package className="w-4 h-4 text-slate-300" />
            <span className="text-[9px] text-slate-400 italic">Slot libero</span>
            {isTeamLead && (
              <span className="text-[8px] text-slate-300">clic su ✏️ per assegnare</span>
            )}
          </div>
        )}
      </div>
    );
  }, [coordToProduct, overrides, activeItemsMap, isTeamLead, onSimulateScan]);

  // ─── Tier section renderer ──────────────────────────────────────────────────

  const renderTier = (tier: TierDef) => {
    if (tier.isFloor) {
      return (
        <div key={tier.id} className={`rounded-2xl border-2 p-3 ${tier.headerBg} flex items-center gap-3`}>
          <Layers className="w-5 h-5 text-slate-500" />
          <div>
            <div className="font-black text-sm text-slate-700">{tier.label}</div>
            <div className="text-xs text-slate-500">{tier.sublabel}</div>
          </div>
          <span className="ml-auto text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-mono">
            Non picking diretto
          </span>
        </div>
      );
    }

    const isExpanded = expandedTiers.has(tier.id);
    const slots = Array.from({ length: tier.count }, (_, i) => i + 1);
    // Cols: NORSAN A=8, NORSAN B=3, ZREEN A/B=6, C=5, D=6
    const cols = tier.isNorsan
      ? (tier.id === 'NA' ? 4 : 3)
      : (tier.id === 'C' ? 5 : 6);

    // Count active slots in this tier
    const activeCount = slots.filter(i => {
      const coord = buildSlotCoordinate(tier, i);
      const product = coordToProduct.get(coord);
      return product && activeItemsMap.has(product.id);
    }).length;

    return (
      <div key={tier.id} className={`rounded-2xl border-2 overflow-hidden shadow-sm ${tier.headerBg}`}>
        {/* Tier header — clickable to expand/collapse */}
        <button
          onClick={() => toggleTier(tier.id)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition text-left"
        >
          <div className={`w-3 h-3 rounded-full ring-2 ${tier.color} bg-white`} />
          <div className="flex-1">
            <div className="font-black text-sm text-slate-900">{tier.label}</div>
            <div className="text-[11px] text-slate-600">{tier.sublabel}</div>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                {activeCount} ORDINE
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-mono">{tier.count} slot</span>
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-slate-500" />
              : <ChevronRight className="w-4 h-4 text-slate-500" />
            }
          </div>
        </button>

        {/* Slot grid */}
        {isExpanded && (
          <div className="bg-white/80 p-3 border-t border-black/10">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {slots.map(i => renderSlot(tier, i))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const norsanTiers = TIERS.filter(t => t.isNorsan);
  const zreenTiers  = TIERS.filter(t => !t.isNorsan);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 overflow-y-auto">
        <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-7xl shadow-2xl overflow-hidden my-2">

          {/* ── Modal Header ─────────────────────────────────────────────── */}
          <div className="sticky top-0 z-10 p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-2xl text-amber-800">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  Mappa Scaffalature 5-Tier — Hub Bolzano
                  {isTeamLead && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                      <Pencil className="w-2.5 h-2.5" /> MODALITÀ LEAD
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {isStation1
                    ? 'NORSAN ⬅️ Sinistra · ZREEN ➡️ Destra'
                    : 'NORSAN ➡️ Destra · ZREEN ⬅️ Sinistra'
                  }
                  {' '}· {NORSAN_PRODUCTS.length} prodotti catalogati
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isTeamLead && (
                <div className="text-[10px] bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Clicca ✏️ su ogni slot per modificare
                </div>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Workstation center bar ────────────────────────────────────── */}
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-700">
              <span className={isStation1 ? 'text-cyan-700 font-black' : 'text-slate-500'}>
                {isStation1 ? '⬅️' : '➡️'} NORSAN (Scaffale laterale)
              </span>
              <span className="px-3 py-1.5 bg-slate-900 text-white rounded-xl flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                TAVOLO IMBALLAGGIO — PC + SCANNER
              </span>
              <span className={!isStation1 ? 'text-emerald-700 font-black' : 'text-slate-500'}>
                ZREEN (Scaffale condiviso) {isStation1 ? '➡️' : '⬅️'}
              </span>
            </div>
          </div>

          {/* ── Main body: 2 columns ──────────────────────────────────────── */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-5 bg-slate-100/40 overflow-y-auto max-h-[75vh]">

            {/* ── LEFT: NORSAN shelf ──────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <h3 className="font-black text-sm text-cyan-900 uppercase tracking-wide">
                  Scaffale NORSAN — {isStation1 ? 'Sinistra' : 'Destra'}
                </h3>
              </div>
              {norsanTiers.map(renderTier)}

              {/* Marketing flyers zone */}
              <div className="rounded-2xl border-2 border-dashed border-cyan-400 bg-cyan-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-[11px] text-cyan-900 uppercase tracking-wide">
                    📄 Volantini & Marketing (N-A8)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MARKETING_FLYERS.map(flyer => (
                    <div key={flyer.id} className="bg-white border border-cyan-300 rounded-xl p-2 flex flex-col gap-1">
                      <span className="text-[10px] font-black text-cyan-900 leading-tight">{flyer.title}</span>
                      <span className="text-[9px] font-mono text-slate-500">{flyer.code}</span>
                      <button
                        onClick={() => onSimulateScan(flyer.code)}
                        className="text-[9px] bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-2 py-0.5 rounded transition self-end"
                      >
                        Scan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: ZREEN shared rack ────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-black text-sm text-emerald-900 uppercase tracking-wide">
                  Scaffale ZREEN 5-Tier — {isStation1 ? 'Destra' : 'Sinistra'}
                </h3>
                {isTeamLead && (
                  <span className="ml-auto text-[10px] text-amber-700 font-bold">
                    ✏️ = modifica slot
                  </span>
                )}
              </div>
              {zreenTiers.map(renderTier)}
            </div>
          </div>

          {/* ── Footer legend ─────────────────────────────────────────────── */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-2 border-amber-400 bg-amber-50" />
              <span>Slot necessario per ordine attivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-50" />
              <span>Scansionato</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-2 border-violet-400 bg-violet-50" />
              <span>Fast-pick buffer (tavolo)</span>
            </div>
            {isTeamLead && (
              <div className="flex items-center gap-1.5 ml-auto">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="font-bold text-amber-700">
                  Modalità Lead: modifiche salvate in localStorage del terminale
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Panel Modal (Lead only) */}
      {editingProduct && (
        <EditPanel
          product={editingProduct}
          override={overrides[editingProduct.id]}
          onSave={(data) => handleSaveOverride(editingProduct, data)}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
};
