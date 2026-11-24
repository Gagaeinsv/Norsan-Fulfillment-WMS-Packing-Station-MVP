import React, { useState, useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  Truck,
  Repeat,
  FileSpreadsheet,
  Printer,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Order } from "../../types/wms";
import {
  printBatchPackingSlips,
  printOrderPackingSlip,
} from "../../services/orderSlipPrinter";

interface OrderQueueProps {
  orders: Order[];
  activeOrderId: string;
  onSelectOrder: (orderId: string) => void;
  onOpenSellyModal?: () => void;
}

type FilterType = "all" | "subscriptions" | "b2b" | "amazon";

export const OrderQueue: React.FC<OrderQueueProps> = ({
  orders,
  activeOrderId,
  onSelectOrder,
  onOpenSellyModal,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const amazonCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.source === "Amazon Marketplace" ||
          o.boxBranding === "neutral_unbranded" ||
          o.boxRecommendation?.startsWith("BOX-AMZ"),
      ).length,
    [orders],
  );

  const standardOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          !(
            o.source === "Amazon Marketplace" ||
            o.boxBranding === "neutral_unbranded" ||
            o.boxRecommendation?.startsWith("BOX-AMZ")
          ),
      ).length,
    [orders],
  );

  // Filter and sort orders based on active filter
  const displayedOrders = useMemo(() => {
    let filtered = [...orders];

    if (activeFilter === "amazon") {
      // Strictly Amazon / Unbranded orders only
      filtered = filtered.filter(
        (o) =>
          o.source === "Amazon Marketplace" ||
          o.boxBranding === "neutral_unbranded" ||
          o.boxRecommendation?.startsWith("BOX-AMZ"),
      );
    } else {
      // In all other standard tabs, separate Amazon orders completely
      filtered = filtered.filter(
        (o) =>
          !(
            o.source === "Amazon Marketplace" ||
            o.boxBranding === "neutral_unbranded" ||
            o.boxRecommendation?.startsWith("BOX-AMZ")
          ),
      );

      if (activeFilter === "subscriptions") {
        filtered = filtered.filter((o) => o.isSubscription);

        // Group identical baskets: sort by the first product ID + total units
        filtered.sort((a, b) => {
          const aKey = `${a.items[0]?.product.id}-${a.items.reduce((s, i) => s + i.quantityRequired, 0)}`;
          const bKey = `${b.items[0]?.product.id}-${b.items.reduce((s, i) => s + i.quantityRequired, 0)}`;
          return aKey.localeCompare(bKey);
        });
      } else if (activeFilter === "b2b") {
        filtered = filtered.filter(
          (o) =>
            o.source.includes("B2B") ||
            o.source.toLowerCase().includes("farmacia"),
        );
      }
    }

    return filtered;
  }, [orders, activeFilter]);

  const unprintedCount = displayedOrders.filter(
    (o) => o.status !== "packed",
  ).length;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col h-full overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="pb-3 mb-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-xs font-bold tracking-tight text-slate-900 truncate">
              {activeFilter === "amazon" ? "Ordini Amazon" : "Coda Ordini"}
            </h3>
            <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md tabular-nums">
              {displayedOrders.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {unprintedCount > 0 && (
            <button
              type="button"
              onClick={() =>
                printBatchPackingSlips(
                  displayedOrders.filter((o) => o.status !== "packed"),
                )
              }
              className="text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer tabular-nums"
              title="Stampa fogli prelievo cartacei con Barcode (schema Team Lead)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Stampa ({unprintedCount})</span>
            </button>
          )}

          {onOpenSellyModal && (
            <button
              type="button"
              onClick={onOpenSellyModal}
              className="text-[11px] font-semibold bg-norsan-50 hover:bg-norsan-100 text-norsan-800 border border-norsan-200 px-2 py-1 rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Importa ordini da file CSV di Selly ERP"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-norsan-700" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter / Segmented Channel Control */}
      <div className="flex flex-col gap-2 mb-3 shrink-0">
        <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
              activeFilter !== "amazon"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Standard</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md tabular-nums ${
                activeFilter !== "amazon"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-200/70 text-slate-600"
              }`}
            >
              {standardOrdersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("amazon")}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
              activeFilter === "amazon"
                ? "bg-amber-400 text-slate-950 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Ordini da spedire con Scatola Neutra Senza Logo (Obbligatorio Amazon)"
          >
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Amazon</span>
            </span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md tabular-nums ${
                activeFilter === "amazon"
                  ? "bg-slate-950 text-amber-300 font-bold"
                  : "bg-amber-100 text-amber-800 font-semibold"
              }`}
            >
              {amazonCount}
            </span>
          </button>
        </div>

        {/* Sub-filters for Standard Orders */}
        {activeFilter !== "amazon" ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                activeFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              Tutti
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("subscriptions")}
              className={`flex-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                activeFilter === "subscriptions"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span>Abbonamenti</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("b2b")}
              className={`flex-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                activeFilter === "b2b"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>B2B</span>
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-950 text-[11px] px-3 py-2 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <div className="font-semibold">Canale Amazon: Solo prodotti NORSAN</div>
              <div className="text-[10px] text-amber-800 mt-0.5">
                Usare esclusivamente scatole neutre (BOX-AMZ) senza loghi né volantini.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Orders List or Empty State */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-1 min-h-0">
        {displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl h-64 my-auto">
            <div className="p-3 bg-white text-norsan-700 rounded-xl border border-slate-200 mb-3 shadow-2xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-slate-800">
              Nessun ordine in questa vista
            </div>
            <div className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
              Tutti gli ordini sono stati imballati o in attesa di sincronizzazione da Selly ERP.
            </div>
            {onOpenSellyModal && (
              <button
                type="button"
                onClick={onOpenSellyModal}
                className="mt-4 px-3.5 py-2 bg-norsan-700 hover:bg-norsan-800 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importa CSV Selly</span>
              </button>
            )}
          </div>
        ) : (
          displayedOrders.map((order) => {
            const isActive = order.id === activeOrderId;
            const totalUnits = order.items.reduce(
              (s, i) => s + i.quantityRequired,
              0,
            );
            const scannedUnits = order.items.reduce(
              (s, i) => s + i.quantityScanned,
              0,
            );
            const isPacked = order.status === "packed";
            const isAmazonOrder =
              order.source === "Amazon Marketplace" ||
              order.boxBranding === "neutral_unbranded";

            let cardSurface =
              "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60";
            if (isActive) {
              cardSurface =
                "border-norsan-300 border-l-4 border-l-norsan-600 bg-norsan-50/45 shadow-xs";
            } else if (isPacked) {
              cardSurface = "border-slate-200/70 bg-slate-50/70 opacity-75";
            }

            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${cardSurface}`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {order.orderNumber}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        printOrderPackingSlip(order);
                      }}
                      className="p-1 rounded-md hover:bg-slate-200/70 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                      title="Stampa distinta cartacea con Barcode per questo ordine"
                    >
                      <Printer className="w-3 h-3" />
                    </button>
                    {isAmazonOrder && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 shrink-0 uppercase">
                        <Package className="w-2.5 h-2.5" />
                        <span>AMZ</span>
                      </span>
                    )}
                  </div>

                  {isPacked ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Spedito</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">
                      {scannedUnits}/{totalUnits} pz
                    </span>
                  )}
                </div>

                <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{order.customerName}</span>
                  {order.isSubscription && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-semibold shrink-0"
                      title={`Abbonamento - Ciclo ${order.subscriptionCycle || 1}`}
                    >
                      <Repeat className="w-2.5 h-2.5" /> #
                      {order.subscriptionCycle || 1}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1.5">
                  <span className="truncate">{order.customerCity}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {order.boxBranding === "neutral_unbranded" && (
                      <span
                        className="text-[9px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                        title="Scatola neutra obbligatoria"
                      >
                        Box Neutra
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Truck className="w-3 h-3 text-slate-400" />
                      <span>{order.courier.replace("DHL ", "")}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
