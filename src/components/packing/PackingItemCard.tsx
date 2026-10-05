/**
 * packing/PackingItemCard.tsx
 * Single product card in the active packing grid.
 * Shows: shelf coordinate, P2L LED badge, product photo, EAN,
 * fragile warning, Kanban replenishment button, scan button, progress bar.
 */

import React from "react";
import {
  MapPin,
  ShieldAlert,
  Barcode,
  BellRing,
  Sparkles,
  Boxes,
  Check,
} from "lucide-react";
import { OrderItem } from "../../types/wms";

interface PackingItemCardProps {
  item: OrderItem;
  index: number;
  stationConfigId: string;
  kanbanAlertItem: string | null;
  onSimulateScan: (ean: string, qty?: number) => void;
  onKanbanRefill: (productName: string, slotCode: string) => void;
}

export const PackingItemCard: React.FC<PackingItemCardProps> = ({
  item,
  index,
  stationConfigId,
  kanbanAlertItem,
  onSimulateScan,
  onKanbanRefill,
}) => {
  const isCompleted = item.quantityScanned >= item.quantityRequired;
  const isPartial = item.quantityScanned > 0 && !isCompleted;
  const progressPercent = Math.min(
    100,
    Math.round((item.quantityScanned / item.quantityRequired) * 100),
  );
  const remainingQty = item.quantityRequired - item.quantityScanned;
  const isBulkMultiple = remainingQty >= 6;
  const isStation1 = stationConfigId === "STATION_01";

  // Reachability direction text
  let reachabilityText = "";
  if (item.product.isFastBuffer) {
    reachabilityText = "";
  } else if (item.product.brand === "NORSAN") {
    reachabilityText = isStation1
      ? "⬅️ ZONA SINISTRA (Scaffale NORSAN)"
      : "➡️ ZONA DESTRA (Scaffale NORSAN)";
  } else if (item.product.brand === "ZREEN") {
    reachabilityText = isStation1
      ? "➡️ ZONA DESTRA (Scaffale ZREEN)"
      : "⬅️ ZONA SINISTRA (Scaffale ZREEN)";
  }

  // Shelf badge color
  let badgeShelfClass = "bg-amber-100 text-amber-950 border-amber-400";
  if (item.product.brand === "ZREEN") {
    if (item.product.colorCategory === "sleep_calm")
      badgeShelfClass = "bg-blue-100 text-blue-900 border-blue-400";
    else if (item.product.colorCategory === "gut_detox")
      badgeShelfClass = "bg-green-100 text-green-900 border-green-400";
    else if (item.product.colorCategory === "amino_energy")
      badgeShelfClass = "bg-orange-100 text-orange-900 border-orange-400";
    else badgeShelfClass = "bg-slate-100 text-slate-900 border-slate-400";
  } else if (item.product.rackSide === "D") {
    badgeShelfClass = "bg-cyan-100 text-cyan-950 border-cyan-400";
  }

  // Card state
  let cardClass =
    "bg-white border-2 border-slate-300 shadow-sm hover:border-slate-400";
  if (isCompleted)
    cardClass =
      "bg-emerald-50/80 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20";
  else if (isPartial)
    cardClass =
      "bg-amber-50/80 border-2 border-amber-500 shadow-md ring-2 ring-amber-500/20";

  // P2L glow
  const hasP2L = !!(item.product.p2lTier && item.product.p2lLedIndex != null);
  const p2lGlowClass =
    hasP2L && !isCompleted
      ? "after:absolute after:inset-0 after:rounded-3xl after:pointer-events-none after:animate-p2l-pulse"
      : "";

  return (
    <div
      className={`rounded-3xl p-4.5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${cardClass} ${p2lGlowClass}`}
    >
      {/* P2L LED Badge */}
      {hasP2L && !isCompleted && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white inline-block" />
          LED {item.product.p2lTier}-{item.product.p2lLedIndex}
        </div>
      )}

      {/* Top: direction + shelf badge */}
      <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-200">
        <div className="text-xs font-black uppercase text-slate-500 tracking-wide">
          {item.product.isFastBuffer ? (
            <span className="text-violet-700">
              📍 TAVOLO — Scatola aperta sul tavolo
            </span>
          ) : (
            reachabilityText
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div
            className={`px-3.5 py-1.5 rounded-xl border-2 font-mono font-black text-xl flex items-center gap-2 shadow-xs ${badgeShelfClass} ${hasP2L && !isCompleted ? "ring-2 ring-emerald-400 shadow-emerald-300 shadow-md" : ""}`}
          >
            <MapPin className="w-5 h-5 text-slate-800" />
            <span>
              {item.product.isFastBuffer
                ? "📍 TAVOLO"
                : item.product.shelfCoordinate || item.product.shelfLocation}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {item.product.brand === "ZREEN" && (
              <span className="text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg">
                ZREEN
              </span>
            )}
            {isCompleted ? (
              <span className="text-xs bg-emerald-600 text-white font-black px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-xs">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>COMPLETO</span>
              </span>
            ) : (
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-300">
                #{index + 1}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: image + details */}
      <div className="my-3.5 flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="w-28 h-28 object-cover rounded-2xl border-2 border-slate-300 bg-white shadow-sm"
          />
          {item.product.fragile && (
            <div
              className="absolute -top-2 -right-2 p-1.5 bg-amber-500 text-slate-950 rounded-full shadow-md"
              title="Flacone in Vetro - Proteggere con pluriball"
            >
              <ShieldAlert className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-slate-900 leading-snug line-clamp-2">
            {item.product.name}
          </h3>
          <p className="text-xs text-slate-600 font-semibold mt-0.5 line-clamp-1">
            {item.product.italianName}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-mono text-slate-600">
            <Barcode className="w-4 h-4 text-slate-500" />
            <span>
              EAN:{" "}
              <strong className="text-slate-900">{item.product.ean}</strong>
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {item.product.fragile && (
              <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                Vetro • Pluriball
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                onKanbanRefill(item.product.name, item.product.shelfLocation)
              }
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition active:scale-95 flex items-center gap-1 ${
                kanbanAlertItem === item.product.shelfLocation
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                  : "bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border-slate-300"
              }`}
            >
              <BellRing className="w-3 h-3" />
              <span>
                {kanbanAlertItem === item.product.shelfLocation
                  ? "✔ Kanban Inviato"
                  : "Chiama Scorta (Kanban)"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: quantity + scan button */}
      <div className="pt-2.5 border-t border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs uppercase font-black text-slate-500">
            Quantità:
          </span>
          <div className="font-mono text-2xl font-black">
            <span
              className={
                isCompleted
                  ? "text-emerald-700"
                  : isPartial
                    ? "text-amber-700"
                    : "text-slate-900"
              }
            >
              {item.quantityScanned}
            </span>
            <span className="text-slate-400 font-normal text-lg">
              {" "}
              / {item.quantityRequired} PZ
            </span>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isCompleted ? "bg-emerald-600" : isPartial ? "bg-amber-500" : "bg-slate-400"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <div className="w-full text-center py-2 bg-emerald-100 text-emerald-900 font-black text-xs rounded-xl border border-emerald-300">
              ✔ Verificato con Scanner
            </div>
          ) : (
            <>
              <button
                onClick={() => onSimulateScan(item.product.ean)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Scansiona (+1)</span>
              </button>
              {isBulkMultiple && (
                <button
                  onClick={() => onSimulateScan(item.product.ean, 6)}
                  className="py-2.5 px-3 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs rounded-xl border border-amber-300 transition active:scale-95 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Boxes className="w-4 h-4 text-amber-800" />
                  <span>Cartone (+6)</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
