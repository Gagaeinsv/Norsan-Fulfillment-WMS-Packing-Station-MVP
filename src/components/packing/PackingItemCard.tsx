/**
 * packing/PackingItemCard.tsx
 * Single product card in the active packing grid.
 * Optimized for 0.5s shelf coordinate & Pick-to-Light glanceability.
 */

import React, { useState } from "react";
import {
  MapPin,
  ShieldAlert,
  Barcode,
  BellRing,
  ScanBarcode,
  Boxes,
  Check,
  CalendarClock,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { OrderItem } from "../../types/wms";
import { WMS_PHASE_CONFIG } from "../../config/wmsPhaseConfig";
import {
  getProductLotInfo,
  updateProductLotInfo,
  rotateToSecondaryLot,
} from "../../services/lotTraceabilityService";

interface PackingItemCardProps {
  item: OrderItem;
  index: number;
  stationConfigId: string;
  kanbanAlertItem: string | null;
  onSimulateScan: (ean: string, qty?: number) => void;
  onKanbanRefill: (productName: string, slotCode: string) => void;
  onUpdateItemLot?: (sku: string, lotNumber: string, expiryDate: string) => void;
}

export const PackingItemCard: React.FC<PackingItemCardProps> = ({
  item,
  index,
  stationConfigId,
  kanbanAlertItem,
  onSimulateScan,
  onKanbanRefill,
  onUpdateItemLot,
}) => {
  const shelfLot = getProductLotInfo(item.product);
  const currentLot = item.lotNumber || shelfLot.lotNumber;
  const currentExp = item.expiryDate || shelfLot.expiryDate;

  const [isEditingLot, setIsEditingLot] = useState(false);
  const [lotInput, setLotInput] = useState(currentLot);
  const [expInput, setExpInput] = useState(currentExp);

  const isCompleted = item.quantityScanned >= item.quantityRequired;
  const isPartial = item.quantityScanned > 0 && !isCompleted;
  const progressPercent = Math.min(
    100,
    Math.round((item.quantityScanned / item.quantityRequired) * 100),
  );
  const remainingQty = item.quantityRequired - item.quantityScanned;
  const isBulkMultiple = remainingQty >= 6;
  const isStation1 = stationConfigId === "STATION_01";

  // Reachability direction metadata
  let directionSide: "left" | "right" | "table" | null = null;
  let reachabilityLabel = "";
  if (item.product.isFastBuffer) {
    directionSide = "table";
    reachabilityLabel = "TAVOLO · Scatola aperta";
  } else if (item.product.brand === "NORSAN") {
    directionSide = isStation1 ? "left" : "right";
    reachabilityLabel = isStation1
      ? "ZONA SINISTRA · NORSAN"
      : "ZONA DESTRA · NORSAN";
  } else if (item.product.brand === "ZREEN") {
    directionSide = isStation1 ? "right" : "left";
    reachabilityLabel = isStation1
      ? "ZONA DESTRA · ZREEN"
      : "ZONA SINISTRA · ZREEN";
  }

  // Shelf badge color
  let badgeShelfClass = "bg-amber-50 text-amber-950 border-amber-300";
  if (item.product.brand === "ZREEN") {
    if (item.product.colorCategory === "sleep_calm")
      badgeShelfClass = "bg-blue-50 text-blue-900 border-blue-300";
    else if (item.product.colorCategory === "gut_detox")
      badgeShelfClass = "bg-emerald-50 text-emerald-900 border-emerald-300";
    else if (item.product.colorCategory === "amino_energy")
      badgeShelfClass = "bg-orange-50 text-orange-900 border-orange-300";
    else badgeShelfClass = "bg-slate-100 text-slate-900 border-slate-300";
  } else if (item.product.rackSide === "D") {
    badgeShelfClass = "bg-cyan-50 text-cyan-950 border-cyan-300";
  }

  // Card state surface
  let cardClass =
    "bg-white border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300";
  if (isCompleted)
    cardClass = "bg-emerald-50/35 border-emerald-400 shadow-xs";
  else if (isPartial)
    cardClass = "bg-amber-50/25 border-amber-400 shadow-xs";

  // P2L glow
  const hasP2L = !!(item.product.p2lTier && item.product.p2lLedIndex != null);
  const p2lGlowClass =
    hasP2L && !isCompleted
      ? "after:absolute after:inset-0 after:rounded-2xl after:pointer-events-none after:animate-p2l-pulse"
      : "";

  return (
    <div
      className={`rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 relative overflow-hidden border ${cardClass} ${p2lGlowClass}`}
    >
      {/* Top: Direction + Shelf Coordinate + P2L LED + Status */}
      <div className="flex flex-col gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 min-w-0">
            {directionSide === "table" && (
              <MapPin className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            )}
            {directionSide === "left" && (
              <ArrowLeft className="w-3.5 h-3.5 text-norsan-700 shrink-0" />
            )}
            {directionSide === "right" && (
              <ArrowRight className="w-3.5 h-3.5 text-norsan-700 shrink-0" />
            )}
            <span
              className={`truncate ${
                directionSide === "table" ? "text-violet-700" : "text-slate-500"
              }`}
            >
              {reachabilityLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {item.product.brand === "ZREEN" && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                ZREEN
              </span>
            )}
            {isCompleted ? (
              <span className="text-[11px] bg-emerald-600 text-white font-semibold px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>COMPLETO</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md tabular-nums">
                #{index + 1}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div
            className={`px-3 py-1 rounded-xl border font-mono font-bold text-lg flex items-center gap-2 ${badgeShelfClass} ${
              hasP2L && !isCompleted
                ? "ring-2 ring-emerald-500/30 border-emerald-400"
                : ""
            }`}
          >
            <MapPin className="w-4 h-4 opacity-70 shrink-0" />
            <span className="tabular-nums">
              {item.product.isFastBuffer
                ? "TAVOLO"
                : item.product.shelfCoordinate || item.product.shelfLocation}
            </span>
          </div>

          {hasP2L && !isCompleted && (
            <div className="flex items-center gap-1.5 bg-emerald-600 text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-full shrink-0 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-white inline-block" />
              <span>
                LED {item.product.p2lTier}-{item.product.p2lLedIndex}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center: Product photo + details */}
      <div className="my-3.5 flex items-start gap-3.5">
        <div className="relative shrink-0">
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="w-24 h-24 object-contain rounded-xl border border-slate-100 bg-slate-50 p-1.5"
          />
          {item.product.fragile && (
            <div
              className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-400 text-slate-950 rounded-full flex items-center justify-center shadow-xs border border-white"
              title="Flacone in Vetro - Proteggere con pluriball"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
            {item.product.name}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
            {item.product.italianName}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              <strong className="text-slate-800">{item.product.ean}</strong>
            </span>
          </div>

          {/* FEFO Lot & Expiry Date Control Strip (Frozen in Phase 1 Packing Station mode) */}
          {WMS_PHASE_CONFIG.ENABLE_FEFO_LOT_TRACKING && (
            <div className="mt-1.5">
              {!isEditingLot ? (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLotInput(currentLot);
                      setExpInput(currentExp);
                      setIsEditingLot(true);
                    }}
                    title="Clicca per modificare il Lotto o la Data di Scadenza (FEFO)"
                    className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 transition cursor-pointer ${
                      shelfLot.fefoStatus === "expiring_soon"
                        ? "bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100"
                        : shelfLot.fefoStatus === "fefo_priority"
                          ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                          : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <CalendarClock className="w-3 h-3 shrink-0" />
                    <span>
                      Lotto: <b>{currentLot}</b> · Scad: <b>{currentExp}</b>
                    </span>
                  </button>

                  {shelfLot.secondaryLot && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = rotateToSecondaryLot(item.product);
                        setLotInput(next.lotNumber);
                        setExpInput(next.expiryDate);
                        if (onUpdateItemLot) {
                          onUpdateItemLot(
                            item.product.sku,
                            next.lotNumber,
                            next.expiryDate,
                          );
                        }
                      }}
                      title={`Esaurito lotto frontale ${currentLot}? Passa al nuovo cartone ${shelfLot.secondaryLot.lotNumber} (${shelfLot.secondaryLot.expiryDate})`}
                      className="text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>→ {shelfLot.secondaryLot.lotNumber}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-1">
                  <input
                    type="text"
                    value={lotInput}
                    onChange={(e) => setLotInput(e.target.value.toUpperCase())}
                    placeholder="Lotto es. L2604N"
                    className="w-20 px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-white border border-slate-300 rounded text-slate-900"
                  />
                  <input
                    type="text"
                    value={expInput}
                    onChange={(e) => setExpInput(e.target.value)}
                    placeholder="MM/AAAA"
                    className="w-18 px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-white border border-slate-300 rounded text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (lotInput.trim() && expInput.trim()) {
                        updateProductLotInfo(
                          item.product.sku,
                          lotInput.trim(),
                          expInput.trim(),
                        );
                        if (onUpdateItemLot) {
                          onUpdateItemLot(
                            item.product.sku,
                            lotInput.trim().toUpperCase(),
                            expInput.trim(),
                          );
                        }
                      }
                      setIsEditingLot(false);
                    }}
                    className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded cursor-pointer"
                  >
                    Salva
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingLot(false)}
                    className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>
              )}

              {shelfLot.fefoNote && !isCompleted && (
                <div className="mt-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-tight flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{shelfLot.fefoNote}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {item.product.fragile && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Vetro · Pluriball
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                onKanbanRefill(item.product.name, item.product.shelfLocation)
              }
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition active:scale-95 flex items-center gap-1 cursor-pointer ${
                kanbanAlertItem === item.product.shelfLocation
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border-slate-200 hover:border-amber-200"
              }`}
            >
              <BellRing className="w-3 h-3" />
              <span>
                {kanbanAlertItem === item.product.shelfLocation
                  ? "Kanban Inviato"
                  : "Chiama Scorta"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Quantity + Progress Bar + Action Button */}
      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
            Quantità
          </span>
          <div className="font-mono text-2xl font-bold tabular-nums">
            <span
              className={
                isCompleted
                  ? "text-emerald-600"
                  : isPartial
                    ? "text-amber-600"
                    : "text-slate-900"
              }
            >
              {item.quantityScanned}
            </span>
            <span className="text-slate-400 font-medium text-base">
              {" "}
              / {item.quantityRequired} pz
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted
                ? "bg-emerald-500"
                : isPartial
                  ? "bg-amber-500"
                  : "bg-slate-300"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          {isCompleted ? (
            <div className="w-full py-2 bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>Verificato con Scanner</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSimulateScan(item.product.ean)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ScanBarcode className="w-4 h-4 text-slate-300" />
                <span>Scansiona (+1)</span>
              </button>
              {isBulkMultiple && (
                <button
                  type="button"
                  onClick={() => onSimulateScan(item.product.ean, 6)}
                  className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs rounded-xl border border-amber-200 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Boxes className="w-4 h-4 text-amber-700" />
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
