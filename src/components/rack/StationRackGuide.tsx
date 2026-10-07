/**
 * rack/StationRackGuide.tsx — Rack Map Modal Orchestrator
 *
 * Renders the full 5-tier warehouse rack map for Hub Bolzano.
 * Delegates slot rendering to RackSlotCell, editing to RackSlotEditPanel.
 * Topology: NORSAN (N-A8 + N-B3) · ZREEN Tier A/B/C/D/E
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  X,
  MapPin,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Layers,
  Pencil,
} from "lucide-react";
import { NORSAN_PRODUCTS, MARKETING_FLYERS } from "../../data/norsanProducts";
import { Order, Product } from "../../types/wms";
import {
  TIERS,
  TierDef,
  SlotOverride,
  loadOverrides,
  saveOverrides,
  buildSlotCoordinate,
} from "./rackTypes";
import { RackSlotCell } from "./RackSlotCell";
import { RackSlotEditPanel } from "./RackSlotEditPanel";

interface StationRackGuideProps {
  activeOrder: Order | null;
  stationConfigId: string;
  isTeamLead: boolean;
  onClose: () => void;
  onSimulateScan: (ean: string) => void;
  onUpdateProductImage?: (productId: string, imageUrl: string) => void;
}

export const StationRackGuide: React.FC<StationRackGuideProps> = ({
  activeOrder,
  stationConfigId,
  isTeamLead,
  onClose,
  onSimulateScan,
  onUpdateProductImage,
}) => {
  const [overrides, setOverrides] =
    useState<Record<string, SlotOverride>>(loadOverrides);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(
    new Set(["NA", "NB", "A", "B", "C", "D"]),
  );

  const isStation1 = stationConfigId === "STATION_01";

  const activeItemsMap = useMemo(() => {
    const m = new Map<
      string,
      { required: number; scanned: number; completed: boolean }
    >();
    activeOrder?.items.forEach((item) => {
      m.set(item.product.id, {
        required: item.quantityRequired,
        scanned: item.quantityScanned,
        completed: item.quantityScanned >= item.quantityRequired,
      });
    });
    return m;
  }, [activeOrder]);

  const coordToProduct = useMemo(() => {
    const m = new Map<string, Product>();
    NORSAN_PRODUCTS.forEach((p) => {
      const coord =
        overrides[p.id]?.customCoordinate ||
        p.shelfCoordinate ||
        p.shelfLocation;
      if (coord) m.set(coord, p);
    });
    return m;
  }, [overrides]);

  const toggleTier = useCallback((id: string) => {
    setExpandedTiers((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const handleSaveOverride = useCallback(
    (product: Product, data: Partial<SlotOverride>) => {
      setOverrides((prev) => {
        const next = {
          ...prev,
          [product.id]: { ...prev[product.id], productId: product.id, ...data },
        };
        saveOverrides(next);
        return next;
      });
      if (data.customPhotoUrl && onUpdateProductImage) {
        onUpdateProductImage(product.id, data.customPhotoUrl);
      }
    },
    [onUpdateProductImage],
  );

  const renderTier = (tier: TierDef) => {
    if (tier.isFloor) {
      return (
        <div
          key={tier.id}
          className={`rounded-2xl border-2 p-3 ${tier.headerBg} flex items-center gap-3`}
        >
          <Layers className="w-5 h-5 text-slate-500" />
          <div>
            <div className="font-black text-sm text-slate-700">
              {tier.label}
            </div>
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
    const cols = tier.isNorsan
      ? tier.id === "NA"
        ? 4
        : 3
      : tier.id === "C"
        ? 5
        : 6;
    const activeCount = slots.filter((i) => {
      const p = coordToProduct.get(buildSlotCoordinate(tier, i));
      return p && activeItemsMap.has(p.id);
    }).length;

    return (
      <div
        key={tier.id}
        className={`rounded-2xl border-2 overflow-hidden shadow-sm ${tier.headerBg}`}
      >
        <button
          onClick={() => toggleTier(tier.id)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition text-left"
        >
          <div
            className={`w-3 h-3 rounded-full ring-2 ${tier.color} bg-white`}
          />
          <div className="flex-1">
            <div className="font-black text-sm text-slate-900">
              {tier.label}
            </div>
            <div className="text-[11px] text-slate-600">{tier.sublabel}</div>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                {activeCount} ORDINE
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-mono">
              {tier.count} slot
            </span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="bg-white/80 p-3 border-t border-black/10">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {slots.map((i) => {
                const coord = buildSlotCoordinate(tier, i);
                const product = coordToProduct.get(coord);
                const info = product
                  ? activeItemsMap.get(product.id)
                  : undefined;
                return (
                  <RackSlotCell
                    key={coord}
                    coord={coord}
                    tier={tier}
                    product={product}
                    override={product ? overrides[product.id] : undefined}
                    isNeeded={!!info && !info.completed}
                    isCompleted={!!info?.completed}
                    isTeamLead={isTeamLead}
                    onSimulateScan={onSimulateScan}
                    onEdit={setEditingProduct}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const norsanTiers = TIERS.filter((t) => t.isNorsan);
  const zreenTiers = TIERS.filter((t) => !t.isNorsan);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 overflow-y-auto">
        <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-7xl shadow-2xl overflow-hidden my-2">
          {/* Header */}
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
                    ? "NORSAN ⬅️ Sinistra · ZREEN ➡️ Destra"
                    : "NORSAN ➡️ Destra · ZREEN ⬅️ Sinistra"}{" "}
                  · {NORSAN_PRODUCTS.length} prodotti catalogati
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isTeamLead && (
                <div className="text-[10px] bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Clicca ✏️ su ogni slot per
                  modificare
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

          {/* Station bar */}
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-700">
              <span
                className={
                  isStation1 ? "text-cyan-700 font-black" : "text-slate-500"
                }
              >
                {isStation1 ? "⬅️" : "➡️"} NORSAN (Scaffale laterale)
              </span>
              <span className="px-3 py-1.5 bg-slate-900 text-white rounded-xl flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                TAVOLO IMBALLAGGIO — PC + SCANNER
              </span>
              <span
                className={
                  !isStation1 ? "text-emerald-700 font-black" : "text-slate-500"
                }
              >
                ZREEN (Scaffale condiviso) {isStation1 ? "➡️" : "⬅️"}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-5 bg-slate-100/40 overflow-y-auto max-h-[75vh]">
            {/* NORSAN */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <h3 className="font-black text-sm text-cyan-900 uppercase tracking-wide">
                  Scaffale NORSAN — {isStation1 ? "Sinistra" : "Destra"}
                </h3>
              </div>
              {norsanTiers.map(renderTier)}
              {/* Marketing Flyers zone */}
              <div className="rounded-2xl border-2 border-dashed border-cyan-400 bg-cyan-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-[11px] text-cyan-900 uppercase tracking-wide">
                    📄 Volantini & Marketing (N-A8)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MARKETING_FLYERS.map((flyer) => (
                    <div
                      key={flyer.id}
                      className="bg-white border border-cyan-300 rounded-xl p-2 flex flex-col gap-1"
                    >
                      <span className="text-[10px] font-black text-cyan-900 leading-tight">
                        {flyer.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {flyer.code}
                      </span>
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

            {/* ZREEN */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-black text-sm text-emerald-900 uppercase tracking-wide">
                  Scaffale ZREEN 5-Tier — {isStation1 ? "Destra" : "Sinistra"}
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

          {/* Footer legend */}
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
                  Modifiche salvate in localStorage del terminale
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingProduct && (
        <RackSlotEditPanel
          product={editingProduct}
          override={overrides[editingProduct.id]}
          onSave={(data) => handleSaveOverride(editingProduct, data)}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
};
