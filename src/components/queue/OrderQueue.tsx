import React, { useState, useMemo } from "react";
import { FileText, CheckCircle2, Truck, Repeat, FileSpreadsheet } from "lucide-react";
import { Order } from "../../types/wms";

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

  return (
    <div className="bg-white border-2 border-slate-300 rounded-2xl p-3.5 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="pb-3 mb-2 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-norsan-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            {activeFilter === "amazon" ? "Ordini Amazon" : "Coda Ordini"} ({displayedOrders.length})
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenSellyModal && (
            <button
              onClick={onOpenSellyModal}
              className="text-[10px] font-bold bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 px-2 py-0.5 rounded transition active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Importa ordini da file CSV di Selly ERP"
            >
              <FileSpreadsheet className="w-3 h-3 text-cyan-700" />
              <span>+ Selly CSV</span>
            </button>
          )}
          <span className="text-[10px] text-slate-600 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Bolzano Hub
          </span>
        </div>
      </div>

      {/* Filter / Category Toggles */}
      <div className="flex flex-col gap-1.5 mb-3">
        {/* Main Channel Split: Standard vs Amazon Tab */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex-1 text-[10px] font-black px-2 py-1.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
              activeFilter === "all"
                ? "bg-slate-800 text-white border-slate-900 shadow-xs"
                : activeFilter !== "amazon"
                  ? "bg-slate-100 text-slate-800 border-slate-300"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Standard (Logo)</span>
            <span className="opacity-80 font-mono text-[9px] px-1.5 py-0.2 rounded bg-black/20">
              {standardOrdersCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter("amazon")}
            className={`flex-1 text-[10px] font-black px-2 py-1.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              activeFilter === "amazon"
                ? "bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400/30"
                : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
            }`}
            title="Ordini da spedire con Scatola Neutra Senza Logo (Obbligatorio Amazon)"
          >
            <span className="flex items-center gap-1">
              <span>📦</span>
              <span>Amazon FBM</span>
            </span>
            <span
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-black ${
                activeFilter === "amazon"
                  ? "bg-slate-950 text-amber-400"
                  : "bg-amber-200 text-amber-950"
              }`}
            >
              {amazonCount}
            </span>
          </button>
        </div>

        {/* Sub-filters for Standard Orders */}
        {activeFilter !== "amazon" ? (
          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={() => setActiveFilter("subscriptions")}
              className={`flex-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
                activeFilter === "subscriptions"
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
              }`}
            >
              <span className="flex items-center gap-1">
                <Repeat className="w-3 h-3" /> Abbonamenti
              </span>
            </button>
            <button
              onClick={() => setActiveFilter("b2b")}
              className={`flex-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
                activeFilter === "b2b"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3" /> B2B / Farmacie
              </span>
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-bold animate-fadeIn">
            <span className="text-base leading-none">⚠️</span>
            <span>Usa <strong>SOLO scatole neutre</strong> (BOX-AMZ) senza loghi NORSAN / ZREEN!</span>
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
        {displayedOrders.map((order) => {
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

          let borderClass =
            "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-400 text-slate-700";
          if (isActive) {
            borderClass =
              "border-2 border-norsan-600 bg-cyan-50/50 shadow-md ring-2 ring-norsan-600/20 text-slate-900";
          } else if (isPacked) {
            borderClass = "border-emerald-200 bg-emerald-50/50 opacity-80";
          }

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${borderClass}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-xs font-black text-norsan-800">
                    {order.orderNumber}
                  </span>
                  {(order.source === "Amazon Marketplace" ||
                    order.boxBranding === "neutral_unbranded") && (
                    <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded border border-amber-600 flex items-center gap-0.5 shrink-0">
                      <span>📦</span>
                      <span>AMAZON</span>
                    </span>
                  )}
                </div>
                {isPacked ? (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />{" "}
                    SPEDITO
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300">
                    {scannedUnits}/{totalUnits} pz
                  </span>
                )}
              </div>

              <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                {order.customerName}
                {order.isSubscription && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-100 text-indigo-800 text-[9px] font-black tracking-wider uppercase"
                    title={`Abbonamento - Ciclo ${order.subscriptionCycle || 1}`}
                  >
                    <Repeat className="w-2.5 h-2.5" /> Abb. #
                    {order.subscriptionCycle || 1}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-600 flex items-center justify-between mt-1">
                <span className="truncate">{order.customerCity}</span>
                <div className="flex items-center gap-1">
                  {order.boxBranding === "neutral_unbranded" && (
                    <span className="text-[9px] font-bold text-amber-900 bg-amber-100 px-1 py-0.5 rounded border border-amber-300" title="Scatola neutra obbligatoria">
                      BOX NEUTRA
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                    <Truck className="w-3 h-3 text-amber-600" />{" "}
                    {order.courier.replace("DHL ", "")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
