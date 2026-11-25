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
  Circle,
  Bookmark,
  Flame,
  Truck,
  ArrowRight,
  Link2,
  AlertTriangle,
  PackageSearch,
  Plus,
  Lock,
  Layers,
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
  currentOperatorId?: string;
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
  currentOperatorId,
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
      <div className="flex flex-col items-center justify-center h-full bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="w-16 h-16 bg-norsan-50 text-norsan-700 rounded-2xl border border-norsan-100 mb-4 flex items-center justify-center">
          <Package className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Postazione Pronta · Lettore Barcode Attivo</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
          Nessun Ordine Attivo sul Banco
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">
          Scansiona il foglio d'ordine Selly (
          <strong className="font-mono text-norsan-700">ORDVE...</strong> o{" "}
          <strong className="font-mono text-norsan-700">INT...</strong>) con la
          pistola ottica oppure importa una nuova distinta ordini da Selly ERP.
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
  const isLockedByOther = Boolean(
    order.lockedByOperatorId &&
      currentOperatorId &&
      order.lockedByOperatorId !== currentOperatorId &&
      order.status !== "packed",
  );
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
    <div className="flex flex-col h-full gap-2.5 select-none min-h-0">
      {/* ── Order Header (2 Clean Rows) ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0">
        {/* Row 1: Identity & Live Progress */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <span className="font-bold text-slate-900 font-mono text-2xl tracking-tight">
                {order.orderNumber}
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-base text-slate-900 truncate">
                {order.customerName}
              </span>
              <span className="text-slate-300 shrink-0">·</span>
              <span className="text-sm text-slate-500 truncate">
                {order.customerCity}
              </span>
            </div>

            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${
                order.priority === "urgent"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              {order.priority === "urgent" ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                  <span>URGENTE</span>
                </>
              ) : (
                <>
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.courier}</span>
                </>
              )}
            </span>

            {order.linkedOrderNumbers && order.linkedOrderNumbers.length > 1 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-800 border-indigo-200 shrink-0 font-mono">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  ORDINE UNIFICATO · {order.linkedOrderNumbers.join(" + ")} · 1 Etichetta DHL
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Takt timer */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border tabular-nums ${
                isOverTaktTime
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                  : isNearTaktTime
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span className="font-mono">
                {elapsedSeconds}s / {targetTaktSeconds}s
              </span>
              <span className="text-[11px] font-medium opacity-80">
                {isOverTaktTime
                  ? `+${elapsedSeconds - targetTaktSeconds}s`
                  : "Ritmo"}
              </span>
            </div>

            {/* Weight */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl tabular-nums">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono">
                {(totalGrossWeight / 1000).toFixed(2)} kg
              </span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isProductsFullyScanned ? "bg-emerald-500" : "bg-norsan-600"
                  }`}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 tabular-nums w-9 text-right">
                {overallProgress}%
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Packaging & Print Controls */}
        <div className="border-t border-slate-100 pt-2.5 mt-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Box type selector */}
            <select
              value={order.boxRecommendation}
              onChange={(e) =>
                onChangeBoxType(
                  (
                    BOX_TYPES.find((b) => b.id === e.target.value) ||
                    BOX_TYPES[1]
                  ).id,
                )
              }
              className="text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-norsan-500 transition"
            >
              {BOX_TYPES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Multi-Collo Box Counter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <Package className="w-3.5 h-3.5 text-norsan-600" />
              <span className="text-[11px] font-medium text-slate-500 mr-0.5">
                Colli:
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdatePackageCount?.(
                    order.id,
                    Math.max(1, (order.packageCount || 1) - 1),
                  )
                }
                disabled={(order.packageCount || 1) <= 1}
                className="w-5 h-5 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer transition"
                title="Riduci numero scatole/colli"
              >
                -
              </button>
              <span className="font-mono font-bold text-xs px-1.5 text-slate-900 tabular-nums">
                {order.packageCount || 1}
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
                className="w-5 h-5 flex items-center justify-center font-bold text-xs text-norsan-700 hover:bg-white rounded-md cursor-pointer transition"
                title="Aggiungi scatola (stampa solo l'etichetta del nuovo collo)"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* DHL Print Timing Mode Switcher */}
            {onToggleDhlPrintTiming && (
              <button
                type="button"
                onClick={onToggleDhlPrintTiming}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                  dhlPrintTiming === "on_scan"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-xl transition active:scale-95 cursor-pointer"
              title="Ristampa foglio distinta con Barcode per questo ordine"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Foglio Prelievo</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Multi-Bench Order Lock Warning ─────────────────────────────────── */}
      {isLockedByOther && (
        <div className="bg-rose-50 border border-rose-300 text-rose-950 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Ordine bloccato su un&apos;altra postazione
              </div>
              <div className="text-xs text-rose-900 mt-0.5">
                Bloccato da{" "}
                <strong>
                  {order.lockedByOperatorName || order.lockedByOperatorId}
                </strong>{" "}
                ({order.lockedByStationId || "ST"}) — doppio imballaggio
                impedito. Contatta il Team Lead per eventuale Force Release.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Flyer checklist ───────────────────────────────────────────────── */}
      {order.marketingFlyers.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2 flex-wrap shadow-[0_1px_2px_rgba(15,23,42,0.03)] shrink-0">
          <Bookmark className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Volantini
          </span>
          {order.marketingFlyers.map((flyer) => (
            <button
              key={flyer.id}
              type="button"
              onClick={() => onToggleFlyer?.(flyer.id)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-semibold transition active:scale-95 cursor-pointer ${
                flyer.isIncluded
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-300"
              }`}
            >
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  flyer.isIncluded ? "bg-emerald-200/70" : "bg-rose-200/70"
                }`}
              >
                {flyer.shelfLocation}
              </span>
              <span className="truncate max-w-[160px]">{flyer.title}</span>
              {flyer.isIncluded ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
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
            className={`px-3.5 py-2.5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0 transition-all ${
              lastScan.otherOrderCandidate
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-rose-50 border-rose-300 text-rose-950"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  lastScan.otherOrderCandidate
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {lastScan.otherOrderCandidate ? (
                  <PackageSearch className="w-4.5 h-4.5" />
                ) : (
                  <AlertTriangle className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider">
                  {lastScan.title}
                </div>
                <div className="text-xs font-medium truncate">
                  {lastScan.message}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {lastScan.otherOrderCandidate && onQuickSwitchOrder && (
                <button
                  type="button"
                  onClick={() =>
                    onQuickSwitchOrder(
                      lastScan.otherOrderCandidate!.orderId,
                      lastScan.rawCode,
                    )
                  }
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    Passa a {lastScan.otherOrderCandidate.orderNumber}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {lastScan.matchedProduct && onForceAddProduct && (
                <button
                  type="button"
                  onClick={() => onForceAddProduct(lastScan.matchedProduct!)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                  title="Aggiungi comunque a questo ordine per testare il flusso"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi (Test MVP)</span>
                </button>
              )}

              {lastScan.resultType === "unknown_code" && onOpenBindModal && (
                <button
                  type="button"
                  onClick={() => onOpenBindModal(lastScan.rawCode)}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="font-mono">Associa {lastScan.rawCode}</span>
                </button>
              )}
            </div>
          </div>
        )}

      {/* ── Item cards grid ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
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
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col xl:flex-row items-center justify-between gap-3 shrink-0 mt-auto">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              order.status === "packed" || isOrderFullyReady
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
              <span>Stato Imballaggio</span>
              <span className="bg-norsan-50 text-norsan-800 border border-norsan-200 px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold">
                Flusso Rapido 1-Scan
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">
              {order.status === "packed" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-700">
                    Ordine completato · Pronto per ritiro DHL
                  </span>
                  {requiredFlyer && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                      <Bookmark className="w-3 h-3 text-slate-400" />
                      <span>
                        {requiredFlyer.title} [{requiredFlyer.shelfLocation}]
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap tabular-nums">
                  <span className="text-slate-800">
                    {totalItemsRequired} pz da imballare ·{" "}
                    <span className="text-emerald-700">
                      {dhlPrintTiming === "on_scan"
                        ? "Etichetta DHL automatica alla scansione bolla"
                        : "Etichetta DHL alla chiusura"}
                    </span>
                  </span>
                  {requiredFlyer && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                      <Bookmark className="w-3 h-3 text-slate-400" />
                      <span>
                        {requiredFlyer.title} [{requiredFlyer.shelfLocation}]
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
          <button
            type="button"
            onClick={onOpenIssueModal}
            className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 active:scale-95 text-rose-700 text-xs font-semibold border border-slate-200 hover:border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Segnala Anomalia</span>
          </button>

          {/* Direct DHL Thermal Label & Order Completion */}
          <button
            type="button"
            onClick={() => printDhlThermalLabel(order, order.packageCount || 1)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-semibold text-xs transition cursor-pointer tabular-nums"
            title="Ristampa l'etichetta termica DHL per questo ordine"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>
              Ristampa DHL (
              {(order.packageCount || 1) > 1
                ? `${order.packageCount} colli`
                : "1 collo"}
              )
            </span>
          </button>

          {onCompleteOrder && (
            <button
              type="button"
              onClick={onCompleteOrder}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs transition shadow-2xs cursor-pointer"
              title="Chiudi questo ordine e passa al prossimo (oppure scansiona semplicemente il prossimo foglio prelievo)"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Completa & Prossimo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
