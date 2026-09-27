import React, { useEffect } from 'react';
import { X, Printer, CheckCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order } from '../types/wms';

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
  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalUnits = order.items.reduce((s, i) => s + i.quantityScanned, 0);
  const isFragile = order.items.some(i => i.product.fragile);

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
                Ordine Verificato al 100% â€¢ Etichetta Spedizione Pronta
              </h2>
              <p className="text-xs text-slate-500">
                Tutti i prodotti corrispondono al foglio d'ordine {order.orderNumber}
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
                <div className="text-[9px] uppercase font-bold text-gray-600">Routing Code</div>
                <div className="text-xl font-black font-mono tracking-wider">
                  {order.customerCountry}-{order.customerProvince || 'REG'}-{order.customerZip}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase font-bold text-gray-600">Pezzi / Peso</div>
                <div className="text-sm font-bold font-mono">1 collo â€¢ {((order.items.reduce((s, i) => s + (i.product.weightGrams * i.quantityScanned), 0) + 180) / 1000).toFixed(2)} kg</div>
              </div>
            </div>

            {/* Shipper & Receiver Section */}
            <div className="mt-3 grid grid-cols-2 gap-3 border-b-2 border-black pb-3 text-xs">
              {/* Shipper (From) */}
              <div className="border-r border-gray-300 pr-2">
                <div className="text-[9px] uppercase font-bold text-gray-500">Mittente (Shipper):</div>
                <div className="font-bold text-[11px] text-gray-900 mt-0.5">NORSAN S.r.l.</div>
                <div className="text-[10px] text-gray-700 leading-tight">
                  Via Macello 30 / SchlachthofstraÃŸe<br />
                  39100 Bolzano (BZ) - ITALY<br />
                  Tel: +39 0471 123456
                </div>
              </div>

              {/* Consignee (To) */}
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">Destinatario (To):</div>
                <div className="font-bold text-sm text-black mt-0.5">{order.customerName}</div>
                <div className="text-xs font-semibold text-gray-800 leading-tight mt-0.5">
                  {order.customerAddress}<br />
                  {order.customerZip} {order.customerCity} ({order.customerProvince})<br />
                  {order.customerCountry === 'IT' ? 'ITALIA' : order.customerCountry}
                </div>
              </div>
            </div>

            {/* Barcode & Tracking Number */}
            <div className="mt-3 text-center space-y-1">
              <div className="text-[9px] font-bold text-gray-500 uppercase">Waybill / Tracking Number</div>
              <div className="font-mono text-sm font-black tracking-widest bg-gray-100 py-1 rounded">
                {order.trackingNumber}
              </div>

              {/* Realistic CSS Barcode Visual */}
              <div className="py-2 flex items-center justify-center">
                <div className="h-14 w-full bg-slate-900 flex items-center justify-around px-2 rounded-sm overflow-hidden">
                  {Array.from({ length: 48 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-full bg-white ${
                        idx % 3 === 0 ? 'w-1.5' : idx % 2 === 0 ? 'w-0.5' : 'w-1'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer tags */}
            <div className="mt-2 pt-2 border-t border-dashed border-gray-400 flex items-center justify-between text-[9px] font-bold text-gray-700">
              <div className="flex items-center gap-1 text-red-600">
                {isFragile && (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>CONTIENE VETRO / FRAGILE</span>
                  </>
                )}
              </div>
              <div className="font-mono">Rif. Ordine: {order.orderNumber} ({totalUnits} pz)</div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition active:scale-95 shadow-xs"
          >
            <Printer className="w-4 h-4 text-norsan-700" />
            <span>Stampa Etichetta Termica (A6)</span>
          </button>

          <button
            onClick={onCompleteAndNext}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition active:scale-95 shadow-md"
          >
            <span>Conferma & Prossimo Ordine</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
