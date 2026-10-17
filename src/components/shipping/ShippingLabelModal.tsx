import React, { useEffect, useState } from "react";
import {
  X,
  Printer,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  Package,
  Layers,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Order } from "../../types/wms";
import { getCode128Bars } from "../../services/barcodeGenerator";
import { getProductLotInfo } from "../../services/lotTraceabilityService";

interface ShippingLabelModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onCompleteAndNext: () => void;
}

export const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({
  order,
  isOpen,
  onClose,
  onCompleteAndNext,
}) => {
  const [packageCount, setPackageCount] = useState<number>(order.packageCount || 1);
  const [activeColloIdx, setActiveColloIdx] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setPackageCount(order.packageCount || 1);
      setActiveColloIdx(0);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [isOpen, order]);

  if (!isOpen) return null;

  const totalUnits = order.items.reduce((s, i) => s + i.quantityScanned, 0);
  const isFragile = order.items.some((i) => i.product.fragile);

  const totalWeightKg = (
    (order.items.reduce(
      (s, i) => s + i.product.weightGrams * i.quantityScanned,
      0,
    ) +
      180 * packageCount) /
    1000
  ).toFixed(2);

  const colloWeightKg = (parseFloat(totalWeightKg) / packageCount).toFixed(2);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-300">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                Ordine Verificato al 100% • Etichetta Spedizione Pronta
              </h2>
              <p className="text-xs text-slate-500">
                Tutti i prodotti corrispondono al foglio d'ordine{" "}
                {order.orderNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Collo Configuration Bar */}
        <div className="bg-blue-50/80 px-6 py-3 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-black text-blue-900">
              Numero di Scatole / Colli (Multi-box):
            </span>
            <div className="flex items-center gap-1 bg-white border border-blue-300 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  if (packageCount > 1) {
                    const newCount = packageCount - 1;
                    setPackageCount(newCount);
                    if (activeColloIdx >= newCount) setActiveColloIdx(newCount - 1);
                  }
                }}
                disabled={packageCount <= 1}
                className="w-7 h-7 flex items-center justify-center font-black text-sm text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-40 transition cursor-pointer"
              >
                -
              </button>
              <span className="font-mono font-black text-xs px-2.5 text-blue-900">
                {packageCount} {packageCount === 1 ? "collo" : "colli"}
              </span>
              <button
                type="button"
                onClick={() => setPackageCount(packageCount + 1)}
                className="w-7 h-7 flex items-center justify-center font-black text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {packageCount > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
              <Layers className="w-3.5 h-3.5" />
              <span>Anteprima Collo:</span>
              <div className="flex gap-1">
                {Array.from({ length: packageCount }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveColloIdx(idx)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                      activeColloIdx === idx
                        ? "bg-blue-600 text-white border-blue-700"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {idx + 1}/{packageCount}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Printable DHL Thermal Label Card */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100">
          <div
            id="printable-dhl-label"
            className="w-full max-w-md bg-white text-black p-5 rounded-2xl shadow-xl border-4 border-yellow-400 font-sans select-text"
          >
            {/* DHL Header Banner */}
            <div className="bg-yellow-400 p-2.5 rounded-lg flex items-center justify-between border-b-2 border-red-600">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-2xl tracking-tighter text-red-600 font-sans italic">
                  DHL
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-black ml-2">
                  {order.courier}
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-black text-yellow-400 px-2 py-0.5 rounded">
                DOMESTIC EXPRESS
              </span>
            </div>

            {/* Routing / AWB Code */}
            <div className="mt-3 border-b-2 border-black pb-2 flex items-center justify-between">
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-600">
                  Routing Code
                </div>
                <div className="text-xl font-black font-mono tracking-wider">
                  {order.customerCountry}-{order.customerProvince || "REG"}-
                  {order.customerZip}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase font-bold text-gray-600">
                  Collo / Peso
                </div>
                <div className="text-sm font-bold font-mono">
                  {packageCount > 1
                    ? `Collo ${activeColloIdx + 1} di ${packageCount} • ${colloWeightKg} kg`
                    : `1 collo • ${totalWeightKg} kg`}
                </div>
              </div>
            </div>

            {/* Shipper & Receiver Section */}
            <div className="mt-3 grid grid-cols-2 gap-3 border-b-2 border-black pb-3 text-xs">
              {/* Shipper (From) */}
              <div className="border-r border-gray-300 pr-2">
                <div className="text-[9px] uppercase font-bold text-gray-500">
                  Mittente (Shipper):
                </div>
                <div className="font-bold text-[11px] text-gray-900 mt-0.5">
                  NORSAN S.r.l.
                </div>
                <div className="text-[10px] text-gray-700 leading-tight">
                  Via Macello 30 / Schlachthofstraße
                  <br />
                  39100 Bolzano (BZ) - ITALY
                  <br />
                  Tel: +39 0471 123456
                </div>
              </div>

              {/* Consignee (To) */}
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">
                  Destinatario (To):
                </div>
                <div className="font-bold text-sm text-black mt-0.5">
                  {order.customerName}
                </div>
                <div className="text-xs text-gray-800 leading-tight mt-0.5">
                  {order.addressDetails?.street
                    ? `${order.addressDetails.street} ${order.addressDetails.houseNumber || ""}`
                    : order.customerAddress}
                  {order.addressDetails?.addressAddition && (
                    <div className="font-semibold text-gray-700">
                      {order.addressDetails.addressAddition}
                    </div>
                  )}
                  <br />
                  {order.customerZip} {order.customerCity} (
                  {order.customerProvince})
                  <br />
                  {order.customerCountry === "IT"
                    ? "ITALIA"
                    : order.customerCountry}
                </div>
              </div>
            </div>

            {/* Barcode & Tracking Number */}
            <div className="mt-3 text-center space-y-1">
              <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center justify-center gap-2">
                <span>Waybill / Tracking Number</span>
                {packageCount > 1 && (
                  <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded">
                    PIECE {activeColloIdx + 1}/{packageCount}
                  </span>
                )}
              </div>
              <div className="font-mono text-sm font-black tracking-widest bg-gray-100 py-1 rounded">
                {packageCount > 1
                  ? `${order.trackingNumber || "JJD0000302488"}-${String(activeColloIdx + 1).padStart(2, "0")}`
                  : order.trackingNumber || "JJD0000302488"}
              </div>

              {/* Genuine Code 128-B Barcode Visual */}
              <div className="py-2 flex items-center justify-center bg-white rounded-sm">
                {(() => {
                  const trackingText =
                    packageCount > 1
                      ? `${order.trackingNumber || "JJD0000302488"}-${String(activeColloIdx + 1).padStart(2, "0")}`
                      : order.trackingNumber || "JJD0000302488";
                  const { bars, totalModules } = getCode128Bars(trackingText);
                  return (
                    <svg
                      viewBox={`0 0 ${totalModules} 52`}
                      className="w-full h-14 max-w-[340px]"
                      preserveAspectRatio="none"
                    >
                      <rect width={totalModules} height={52} fill="#ffffff" />
                      <g fill="#000000">
                        {bars.map((bar, idx) => (
                          <rect
                            key={idx}
                            x={bar.x}
                            y={2}
                            width={bar.width}
                            height={48}
                          />
                        ))}
                      </g>
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Footer tags */}
            <div className="mt-2 pt-2 border-t border-dashed border-gray-400 flex flex-col gap-1 text-[9px] font-bold text-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-red-600">
                  {isFragile && (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>CONTIENE VETRO / FRAGILE</span>
                    </>
                  )}
                </div>
                <div className="font-mono">
                  Rif. Ordine: {order.orderNumber} ({totalUnits} pz)
                  {packageCount > 1 && ` [Collo ${activeColloIdx + 1}/${packageCount}]`}
                </div>
              </div>
              <div className="text-[8px] font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 truncate">
                Tracciabilità Lotti FEFO:{" "}
                {order.items
                  .map((i) => {
                    const lot = getProductLotInfo(i.product);
                    return `${i.product.sku}: ${i.lotNumber || lot.lotNumber} (${i.expiryDate || lot.expiryDate})`;
                  })
                  .join(" • ")}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition active:scale-95 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-700" />
            <span>
              {packageCount > 1
                ? `Stampa Tutte le ${packageCount} Etichette DHL`
                : "Stampa Etichetta Termica (A6)"}
            </span>
          </button>

          <button
            onClick={onCompleteAndNext}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition active:scale-95 shadow-md cursor-pointer"
          >
            <span>Conferma & Prossimo Ordine</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
