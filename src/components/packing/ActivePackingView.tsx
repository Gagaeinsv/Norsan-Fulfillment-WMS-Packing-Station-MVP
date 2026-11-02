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
  Package,
  CheckCircle2,
} from "lucide-react";
import { Order, BoxType, ScanEvent, Product } from "../../types/wms";
import { BOX_TYPES } from "../../data/norsanProducts";
import { PackingBanners } from "./PackingBanners";
import { PackingItemCard } from "./PackingItemCard";
import { printOrderPackingSlip } from "../../services/orderSlipPrinter";
import { printDhlThermalLabel } from "../../services/dhlLabelPrinter";

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
  lastScan?: ScanEvent | null;
  onQuickSwitchOrder?: (orderId: string, autoScanBarcode?: string) => void;
  onForceAddProduct?: (product: Product) => void;
  onOpenBindModal?: (barcode: string) => void;
  onConfirmAllItems?: () => void;
  onUpdateItemLot?: (sku: string, lotNumber: string, expiryDate: string) => void;
  onUpdatePackageCount?: (orderId: string, count: number) => void;
  onCompleteOrder?: () => void;
  dhlPrintTiming?: "on_scan" | "on_finish";
  onToggleDhlPrintTiming?: () => void;
}

export const ActivePackingView: React.FC<ActivePackingViewProps> = ({
  order,
  onSimulateScan,
  onToggleFlyer,
  onOpenLabelModal: _onOpenLabelModal,
  onOpenIssueModal,
  onChangeBoxType,
  stationConfigId,
  onToggleGift,
  onTogglePhysicalDocument,
  lastScan,
  onQuickSwitchOrder,
  onForceAddProduct,
  onOpenBindModal,
  onConfirmAllItems: _onConfirmAllItems,
  onUpdateItemLot,
  onUpdatePackageCount,
  onCompleteOrder,
  dhlPrintTiming = "on_scan",
  onToggleDhlPrintTiming,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [kanbanAlertItem, setKanbanAlertItem] = useState<string | null>(null);

  useEffect(() => {
    setElapsedSeconds(0);
    if (!order?.id) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [order?.id]);

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white border-2 border-slate-300 rounded-2xl p-8 text-center shadow-xs">
        <div className="p-4 bg-cyan-50 text-cyan-700 rounded-3xl border border-cyan-200 mb-4 shadow-xs">
          <Package className="w-12 h-12 text-cyan-600" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold font-mono mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>Postazione Operativa Pronta • Lettore Barcode Attivo</span>
        </div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight">
          Nessun Ordine Attivo sul Banco
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">
          Scansiona il foglio d'ordine Selly (
          <strong className="font-mono text-cyan-800">ORDVE...</strong> o{" "}
          <strong className="font-mono text-cyan-800">INT...</strong>) con la
          pistola ottica oppure carica una nuova distinta ordini da Selly ERP.
        </p>
      </div>
    );
  }

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

  const targetTaktSeconds = totalItemsRequired > 5 ? 75 : 40;
  const isOverTaktTime = elapsedSeconds > targetTaktSeconds;
  const isNearTaktTime =
    elapsedSeconds > targetTaktSeconds * 0.75 && !isOverTaktTime;

  const handleKanbanRefill = (_name: string, slotCode: string) => {
    setKanbanAlertItem(slotCode);
    setTimeout(() => setKanbanAlertItem(null), 2500);
  };

  return (
    <div className="flex flex-col h-full gap-2 select-none min-h-0">
      {/* ── Order Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <FileText className="w-6 h-6 text-slate-500" />
            <span className="font-black text-slate-900 font-mono text-3xl">
              {order.orderNumber}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 min-w-0">
            <MapPin className="w-5 h-5 shrink-0" />
            <span className="font-bold text-xl truncate">{order.customerName}</span>
            <span className="text-slate-400 shrink-0">·</span>
            <span className="text-base truncate">{order.customerCity}</span>
          </div>
          <span
            className={`text-sm font-bold px-3 py-1.5 rounded-lg border shrink-0 ${
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

          {/* Multi-Collo Box Counter */}
          <div className="flex items-center gap-1 bg-white border-2 border-slate-300 rounded-xl px-2 py-1 shadow-2xs">
            <Package className="w-3.5 h-3.5 text-blue-700" />
            <span className="text-[11px] font-bold text-slate-600">Scatole:</span>
            <button
              type="button"
              onClick={() =>
                onUpdatePackageCount?.(
                  order.id,
                  Math.max(1, (order.packageCount || 1) - 1),
                )
              }
              disabled={(order.packageCount || 1) <= 1}
              className="w-5 h-5 flex items-center justify-center font-black text-xs text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
              title="Riduci numero scatole/colli"
            >
              -
            </button>
            <span className="font-mono font-black text-xs px-1 text-blue-900">
              {order.packageCount || 1}{" "}
              {(order.packageCount || 1) === 1 ? "collo" : "colli"}
            </span>
            <button
              type="button"
              onClick={() => {
                const nextCount = (order.packageCount || 1) + 1;
                onUpdatePackageCount?.(order.id, nextCount);
                if (dhlPrintTiming === "on_scan") {
                  printDhlThermalLabel(order, nextCount, nextCount - 1);
                }
              }}
              className="w-5 h-5 flex items-center justify-center font-black text-xs text-blue-700 hover:bg-blue-100 rounded cursor-pointer"
              title="Aggiungi scatola (stampa solo l'etichetta del nuovo collo)"
            >
              +
            </button>
          </div>

          {/* DHL Print Timing Mode Switcher */}
          {onToggleDhlPrintTiming && (
            <button
              type="button"
              onClick={onToggleDhlPrintTiming}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition active:scale-95 cursor-pointer shadow-2xs ${
                dhlPrintTiming === "on_scan"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100"
              }`}
              title="Cambia momento stampa: All'Avvio (subito allo scan bolla) oppure A Chiusura (a scatole pronte)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {dhlPrintTiming === "on_scan"
                  ? "DHL: All'Avvio"
                  : "DHL: A Chiusura"}
              </span>
            </button>
          )}

          {/* Quick Print Paper Slip button */}
          <button
            type="button"
            onClick={() => printOrderPackingSlip(order)}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-xl transition active:scale-95 shadow-2xs cursor-pointer"
            title="Ristampa foglio distinta con Barcode per questo ordine"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Foglio Prelievo</span>
          </button>

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
        dhlPrintTiming={dhlPrintTiming}
      />

      {/* ── Active Scan Error / Candidate Action Banner ─────────────────────── */}
      {lastScan &&
        (lastScan.resultType === "wrong_product" ||
          lastScan.resultType === "unknown_code") && (
          <div
            className={`p-3 rounded-xl border-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md shrink-0 transition-all ${
              lastScan.otherOrderCandidate
                ? "bg-amber-50 border-amber-400 text-amber-950 animate-pulse"
                : "bg-rose-50 border-rose-400 text-rose-950"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-black/10 text-xl flex-shrink-0">
                {lastScan.otherOrderCandidate ? "📦" : "⚠️"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-wider">
                  {lastScan.title}
                </div>
                <div className="text-sm font-semibold truncate">
                  {lastScan.message}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {lastScan.otherOrderCandidate && onQuickSwitchOrder && (
                <button
                  onClick={() =>
                    onQuickSwitchOrder(
                      lastScan.otherOrderCandidate!.orderId,
                      lastScan.rawCode
                    )
                  }
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs transition active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    👉 Passa all'ordine {lastScan.otherOrderCandidate.orderNumber}
                  </span>
                </button>
              )}

              {lastScan.matchedProduct && onForceAddProduct && (
                <button
                  onClick={() => onForceAddProduct(lastScan.matchedProduct!)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 shadow-sm cursor-pointer"
                  title="Aggiungi comunque a questo ordine per testare il flusso"
                >
                  + Aggiungi a questo ordine (Test MVP)
                </button>
              )}

              {lastScan.resultType === "unknown_code" && onOpenBindModal && (
                <button
                  onClick={() => onOpenBindModal(lastScan.rawCode)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs transition active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
                >
                  <span>🔗 Associa codice [{lastScan.rawCode}]</span>
                </button>
              )}
            </div>
          </div>
        )}

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
              onUpdateItemLot={onUpdateItemLot}
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
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-rose-50 active:scale-95 text-rose-700 hover:text-rose-900 text-xs font-bold border border-slate-300 hover:border-rose-300 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Segnala Anomalia</span>
          </button>

          {/* Direct DHL Thermal Label & Order Completion */}
          <button
            type="button"
            onClick={() => printDhlThermalLabel(order, order.packageCount || 1)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs border border-slate-700 transition shadow-xs cursor-pointer"
            title="Ristampa l'etichetta termica DHL per questo ordine"
          >
            <Printer className="w-4 h-4 text-yellow-400" />
            <span>Ristampa DHL ({(order.packageCount || 1) > 1 ? `${order.packageCount} colli` : "1 collo"})</span>
          </button>

          {onCompleteOrder && (
            <button
              type="button"
              onClick={onCompleteOrder}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs transition shadow-md cursor-pointer"
              title="Chiudi questo ordine e passa al prossimo (oppure scansiona semplicemente il prossimo foglio prelievo)"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Completa & Prossimo Ordine</span>
              <ChevronRight className="w-4 h-4" />
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
