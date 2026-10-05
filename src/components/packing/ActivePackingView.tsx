/**
 * packing/ActivePackingView.tsx — Packing workflow orchestrator
 *
 * Composes: order header, flyer checklist, PackingBanners, PackingItemCard grid, footer.
 * All banner logic delegated to PackingBanners.
 * All item card logic delegated to PackingItemCard.
 */

import React, { useState, useEffect } from "react";
import {
  MapPin,
  FileText,
  AlertOctagon,
  Printer,
  Scale,
  ChevronRight,
  ShieldCheck,
  Repeat,
} from "lucide-react";
import { Order, BoxType } from "../../types/wms";
import { BOX_TYPES } from "../../data/norsanProducts";
import { PackingBanners } from "./PackingBanners";
import { PackingItemCard } from "./PackingItemCard";

interface ActivePackingViewProps {
  order: Order;
  onSimulateScan: (barcode: string, quantity?: number) => void;
  onToggleFlyer?: (flyerId: string) => void;
  onOpenLabelModal: () => void;
  onOpenIssueModal: () => void;
  onChangeBoxType: (boxType: BoxType) => void;
  stationConfigId: string;
  onToggleGift?: () => void;
  onTogglePhysicalDocument?: () => void;
}

export const ActivePackingView: React.FC<ActivePackingViewProps> = ({
  order,
  onSimulateScan,
  onToggleFlyer,
  onOpenLabelModal,
  onOpenIssueModal,
  onChangeBoxType,
  stationConfigId,
  onToggleGift,
  onTogglePhysicalDocument,
}) => {
  const totalItemsRequired = order.items.reduce(
    (s, it) => s + it.quantityRequired,
    0,
  );
  const totalItemsScanned = order.items.reduce(
    (s, it) => s + it.quantityScanned,
    0,
  );
  const isProductsFullyScanned =
    order.items.length > 0 &&
    order.items.every((it) => it.quantityScanned >= it.quantityRequired);
  const isFlyersFullyScanned = order.marketingFlyers.every((f) => f.isIncluded);
  const requiresGift = order.retentionGift && order.retentionGift !== "none";
  const isGiftConfirmed = !requiresGift || order.giftConfirmed;
  const isPhysicalDocumentConfirmed =
    !order.requiresPhysicalDocument || order.physicalDocumentConfirmed;
  const isOrderFullyReady =
    isProductsFullyScanned &&
    isFlyersFullyScanned &&
    isGiftConfirmed &&
    isPhysicalDocumentConfirmed;
  const overallProgress =
    totalItemsRequired > 0
      ? Math.round((totalItemsScanned / totalItemsRequired) * 100)
      : 0;

  const productsWeightGrams = order.items.reduce(
    (s, it) => s + it.product.weightGrams * it.quantityScanned,
    0,
  );
  const totalGrossWeight = productsWeightGrams + 180;
  const requiredFlyer = order.marketingFlyers[0];

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const targetTaktSeconds = totalItemsRequired > 5 ? 75 : 40;
  useEffect(() => {
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [order.id]);
  const isOverTaktTime = elapsedSeconds > targetTaktSeconds;
  const isNearTaktTime =
    elapsedSeconds > targetTaktSeconds * 0.75 && !isOverTaktTime;

  const [kanbanAlertItem, setKanbanAlertItem] = useState<string | null>(null);
  const handleKanbanRefill = (_name: string, slotCode: string) => {
    setKanbanAlertItem(slotCode);
    setTimeout(() => setKanbanAlertItem(null), 2500);
  };

  return (
    <div className="flex flex-col h-full gap-2 select-none min-h-0">
      {/* ── Order Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-300 rounded-xl p-2 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            <span className="font-black text-slate-900 font-mono text-base">
              {order.orderNumber}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <MapPin className="w-4 h-4" />
            <span className="font-semibold text-sm">{order.customerName}</span>
            <span className="text-slate-400">·</span>
            <span className="text-sm">{order.customerCity}</span>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
              order.priority === "urgent"
                ? "bg-red-100 text-red-800 border-red-300 animate-pulse"
                : "bg-slate-100 text-slate-700 border-slate-300"
            }`}
          >
            {order.priority === "urgent" ? "🔥 URGENTE" : order.courier}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Takt timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isOverTaktTime
                ? "bg-red-100 text-red-800 border-red-300 animate-pulse"
                : isNearTaktTime
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-slate-100 text-slate-700 border-slate-300"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>
              {elapsedSeconds}s / {targetTaktSeconds}s{" "}
              {isOverTaktTime
                ? "RITMO +" + (elapsedSeconds - targetTaktSeconds) + "S"
                : "IN RITMO LEAN"}
            </span>
          </div>

          {/* Box type selector */}
          <select
            value={order.boxRecommendation}
            onChange={(e) =>
              onChangeBoxType(
                (BOX_TYPES.find((b) => b.id === e.target.value) || BOX_TYPES[1])
                  .id,
              )
            }
            className="text-xs font-bold border-2 border-slate-300 rounded-xl px-2 py-1.5 bg-white text-slate-700 cursor-pointer hover:border-slate-400 transition"
          >
            {BOX_TYPES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branding === "norsan_logo"
                  ? "🐟"
                  : b.branding === "zreen_logo"
                    ? "🌿"
                    : "📦"}{" "}
                {b.name}
              </option>
            ))}
          </select>

          {/* Weight */}
          <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-xl">
            <Scale className="w-3.5 h-3.5" />
            <span>{(totalGrossWeight / 1000).toFixed(2)} kg</span>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-1.5">
            <div className="text-xs font-black text-slate-700">
              {overallProgress}%
            </div>
            <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isProductsFullyScanned ? "bg-emerald-600" : "bg-amber-500"}`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Flyer checklist ───────────────────────────────────────────────── */}
      {order.marketingFlyers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-2 flex-wrap shadow-xs shrink-0">
          <BookmarkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-black text-slate-500 uppercase tracking-wide mr-1">
            Volantini:
          </span>
          {order.marketingFlyers.map((flyer) => (
            <button
              key={flyer.id}
              onClick={() => onToggleFlyer?.(flyer.id)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-bold transition active:scale-95 ${
                flyer.isIncluded
                  ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                  : "bg-rose-50 text-rose-800 border-rose-300 animate-pulse"
              }`}
            >
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-black ${flyer.isIncluded ? "bg-emerald-200/90" : "bg-rose-200/90"}`}
              >
                [{flyer.shelfLocation}]
              </span>
              <span className="truncate max-w-[140px] font-semibold">
                {flyer.title}
              </span>
              {flyer.isIncluded ? (
                <span className="text-emerald-600 font-black">✓</span>
              ) : (
                <span className="text-rose-600 font-black text-lg leading-none">
                  *
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Contextual banners ────────────────────────────────────────────── */}
      <PackingBanners
        order={order}
        requiresGift={!!requiresGift}
        onToggleGift={onToggleGift}
        onTogglePhysicalDocument={onTogglePhysicalDocument}
      />

      {/* ── Item cards grid ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {order.items.map((item, index) => (
            <PackingItemCard
              key={item.product.id}
              item={item}
              index={index}
              stationConfigId={stationConfigId}
              kanbanAlertItem={kanbanAlertItem}
              onSimulateScan={onSimulateScan}
              onKanbanRefill={handleKanbanRefill}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-300 rounded-xl p-2 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-2 shrink-0 mt-auto">
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded-lg border flex items-center justify-center ${
              isOrderFullyReady
                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                : "bg-slate-100 border-slate-300 text-slate-600"
            }`}
          >
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
              <span>Stato Imballaggio Ordine</span>
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-black font-mono">
                100% POKA-YOKE
              </span>
            </div>
            <div className="text-base font-black text-slate-900">
              {isOrderFullyReady ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-700">
                    Tutti i {totalItemsRequired} prodotti scansionati! Pronto
                    per la spedizione.
                  </span>
                  {requiredFlyer && (
                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      💡 Ricorda: {requiredFlyer.title} [
                      {requiredFlyer.shelfLocation}]
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-amber-800">
                  Mancano {totalItemsRequired - totalItemsScanned} prodotti da
                  scansionare
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={onOpenIssueModal}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-rose-50 active:scale-95 text-rose-700 hover:text-rose-900 text-xs font-bold border border-slate-300 hover:border-rose-300 transition flex items-center gap-1.5 shadow-xs"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Segnala Anomalia</span>
          </button>
          {isOrderFullyReady ? (
            <button
              onClick={onOpenLabelModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-base font-black tracking-wide shadow-lg transition-all animate-pulse cursor-pointer"
            >
              <Printer className="w-5 h-5 text-white" />
              <span>STAMPA ETICHETTA {order.courier.toUpperCase()}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              disabled
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold border border-slate-300 cursor-not-allowed"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>
                STAMPA BLOCCATA (
                {!isProductsFullyScanned
                  ? `${totalItemsScanned}/${totalItemsRequired} SCANSIONATI`
                  : "VOLANTINI MANCANTI"}
                )
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Local icon alias (BookOpen → simpler import)
const BookmarkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
    />
  </svg>
);
