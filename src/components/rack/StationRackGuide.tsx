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
  ArrowLeft,
  ArrowRight,
  FileText,
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
    new Set(["NA", "A", "B", "C", "D"]),
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
          className={`rounded-2xl border p-3 ${tier.headerBg} flex items-center gap-3`}
        >
          <Layers className="w-5 h-5 text-slate-500" />
          <div>
            <div className="font-bold text-sm text-slate-800">
              {tier.label}
            </div>
            <div className="text-xs text-slate-500">{tier.sublabel}</div>
          </div>
          <span className="ml-auto text-[11px] bg-white border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-mono font-medium">
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
        className={`rounded-2xl border overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${tier.headerBg}`}
      >
        <button
          type="button"
          onClick={() => toggleTier(tier.id)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/[0.03] transition text-left cursor-pointer"
        >
          <div
            className={`w-3 h-3 rounded-full ring-2 ${tier.color} bg-white shrink-0`}
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-slate-900">
              {tier.label}
            </div>
            <div className="text-[11px] text-slate-600">{tier.sublabel}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeCount > 0 && (
              <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full tabular-nums">
                {activeCount} ORDINE
              </span>
            )}
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
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
          <div className="bg-white/90 p-3 border-t border-slate-200/70">
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
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-start justify-center p-3 overflow-y-auto">
        <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-7xl shadow-xl overflow-hidden my-2 select-none">
          {/* Header */}
          <div className="sticky top-0 z-10 px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Mappa Scaffalature 5-Tier · Hub Bolzano</span>
                  {isTeamLead && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                      <Pencil className="w-2.5 h-2.5" />
                      <span>MODALITÀ LEAD</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    NORSAN{" "}
                    {isStation1 ? (
                      <>
                        <ArrowLeft className="w-3 h-3 text-norsan-700" />
                        <span>Sinistra</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3 h-3 text-norsan-700" />
                        <span>Destra</span>
                      </>
                    )}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    ZREEN{" "}
                    {isStation1 ? (
                      <>
                        <ArrowRight className="w-3 h-3 text-emerald-700" />
                        <span>Destra</span>
                      </>
                    ) : (
                      <>
                        <ArrowLeft className="w-3 h-3 text-emerald-700" />
                        <span>Sinistra</span>
                      </>
                    )}
                  </span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {NORSAN_PRODUCTS.length} prodotti catalogati
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isTeamLead && (
                <div className="hidden sm:flex text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-xl font-semibold items-center gap-1.5">
                  <Pencil className="w-3 h-3" />
                  <span>Clicca icona modifica sullo slot</span>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Station bar */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80">
            <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 ${
                  isStation1 ? "text-norsan-700 font-bold" : "text-slate-500"
                }`}
              >
                {isStation1 ? (
                  <ArrowLeft className="w-3.5 h-3.5" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                <span>NORSAN (Scaffale laterale)</span>
              </span>
              <span className="px-3 py-1 bg-slate-900 text-white rounded-xl flex items-center gap-2 text-[11px] font-semibold">
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                <span>TAVOLO IMBALLAGGIO · PC + SCANNER</span>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 ${
                  !isStation1 ? "text-emerald-700 font-bold" : "text-slate-500"
                }`}
              >
                <span>ZREEN (Scaffale condiviso)</span>
                {isStation1 ? (
                  <ArrowRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowLeft className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-[#f4f6f9] overflow-y-auto max-h-[74vh]">
            {/* NORSAN */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-norsan-600" />
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Scaffale NORSAN · {isStation1 ? "Sinistra" : "Destra"}
                </h3>
              </div>
              {norsanTiers.map(renderTier)}
              {/* Marketing Flyers zone */}
              <div className="rounded-2xl border border-dashed border-norsan-300 bg-norsan-50/50 p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5 text-norsan-700" />
                  <span className="font-bold text-[11px] text-norsan-900 uppercase tracking-wider">
                    Volantini & Marketing (Sul Tavolo · Nessun Prodotto)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MARKETING_FLYERS.map((flyer) => (
                    <div
                      key={flyer.id}
                      className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1"
                    >
                      <span className="text-[11px] font-semibold text-slate-900 leading-tight">
                        {flyer.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {flyer.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSimulateScan(flyer.code)}
                        className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-semibold px-2.5 py-1 rounded-lg transition self-end cursor-pointer mt-0.5"
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
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Scaffale ZREEN 5-Tier · {isStation1 ? "Destra" : "Sinistra"}
                </h3>
                {isTeamLead && (
                  <span className="ml-auto text-[11px] text-amber-700 font-semibold inline-flex items-center gap-1">
                    <Pencil className="w-3 h-3" />
                    <span>modifica slot</span>
                  </span>
                )}
              </div>
              {zreenTiers.map(renderTier)}
            </div>
          </div>

          {/* Footer legend */}
          <div className="px-5 py-3 bg-white border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-amber-400 bg-amber-50" />
              <span>Slot necessario per ordine attivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-emerald-400 bg-emerald-50" />
              <span>Scansionato</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-violet-300 bg-violet-50" />
              <span>Fast-pick buffer (tavolo)</span>
            </div>
            {isTeamLead && (
              <div className="flex items-center gap-1.5 ml-auto">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-amber-700">
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
