/**
 * packing/PackingBanners.tsx
 * All contextual alert banners for the active packing order:
 *   - Special Notes (WhatsApp/Telefono)
 *   - Physical Document required (B2B/Print-on-Demand)
 *   - Retention Gift (1st/2nd order marketing gift)
 *   - SellyErp Loyalty badge (repeat customer)
 */

import React from "react";
import { AlertOctagon, Check } from "lucide-react";
import { Order } from "../../types/wms";

interface PackingBannersProps {
  order: Order;
  requiresGift: boolean;
  onToggleGift?: () => void;
  onTogglePhysicalDocument?: () => void;
}

export const PackingBanners: React.FC<PackingBannersProps> = ({
  order,
  requiresGift,
  onToggleGift,
  onTogglePhysicalDocument,
}) => (
  <>
    {/* Special Notes — WhatsApp / Telefono */}
    {order.source === "WhatsApp / Telefono" && order.specialNotes && (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 p-3 rounded-r flex items-start gap-3 shadow-sm">
        <AlertOctagon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-black text-sm uppercase">
            Nota Speciale (Ordine Telefonico/WhatsApp)
          </div>
          <div className="text-sm font-semibold mt-1">{order.specialNotes}</div>
        </div>
      </div>
    )}

    {/* Physical Document — B2B / Print-on-Demand */}
    {order.requiresPhysicalDocument && (
      <div
        className={`p-2 rounded-lg border-2 flex items-center justify-between shadow-sm ${
          order.physicalDocumentConfirmed
            ? "bg-emerald-50 border-emerald-400"
            : "bg-rose-50 border-rose-500 ring-2 ring-rose-500/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="text-xl">📄</div>
          <div>
            <div
              className={`font-black text-sm ${order.physicalDocumentConfirmed ? "text-emerald-800" : "text-rose-900"}`}
            >
              OBBLIGATORIO: Stampare e inserire Fattura / DDT cartaceo
            </div>
            <div className="text-xs text-slate-600 font-semibold mt-0.5">
              Richiesta del cliente o documento B2B
            </div>
          </div>
        </div>
        <button
          onClick={onTogglePhysicalDocument}
          className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all active:scale-95 ${
            order.physicalDocumentConfirmed
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          <div
            className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
              order.physicalDocumentConfirmed
                ? "border-white bg-emerald-500"
                : "border-slate-300 bg-white"
            }`}
          >
            {order.physicalDocumentConfirmed && (
              <Check className="w-3.5 h-3.5 text-white" />
            )}
          </div>
          <span>Documento inserito</span>
        </button>
      </div>
    )}

    {/* Retention Gift */}
    {requiresGift && (
      <div
        className={`p-2 rounded-lg border-2 flex items-center justify-between shadow-sm ${
          order.giftConfirmed
            ? "bg-emerald-50 border-emerald-400"
            : order.retentionGift === "card_discount_15"
              ? "bg-purple-100 border-purple-500 ring-2 ring-purple-500/20"
              : "bg-orange-100 border-orange-500 ring-2 ring-orange-500/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="text-xl">
            {order.retentionGift === "card_discount_15"
              ? "🎁"
              : order.retentionGift === "branded_spoon"
                ? "🥄"
                : "📋"}
          </div>
          <div>
            <div
              className={`font-black text-sm ${order.giftConfirmed ? "text-emerald-800" : "text-slate-900"}`}
            >
              {order.customerOrderCount}° ORDINE:{" "}
              {order.retentionGift === "card_discount_15"
                ? " Inserire Cartolina Sconto -15% (Slot #2)"
                : order.retentionGift === "branded_spoon"
                  ? " Inserire Cucchiaio Dosatore NORSAN!"
                  : " Inserire Volantino Re-test Omegametrix (Slot #3)"}
            </div>
          </div>
        </div>
        <button
          onClick={onToggleGift}
          className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all active:scale-95 ${
            order.giftConfirmed
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          <div
            className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
              order.giftConfirmed
                ? "border-white bg-emerald-500"
                : "border-slate-300 bg-white"
            }`}
          >
            {order.giftConfirmed && (
              <Check className="w-3.5 h-3.5 text-white" />
            )}
          </div>
          <span>Ho inserito l'omaggio nel pacco</span>
        </button>
      </div>
    )}

    {/* SellyErp Loyalty Badge */}
    {(order.source === "SellyErp INT" || order.source === "SellyErp ORDVE") &&
      order.customerOrderCount > 1 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 p-3 rounded-r flex items-center gap-3 shadow-sm">
          <span className="text-xl">⭐</span>
          <div>
            <div className="font-black text-sm">
              Cliente Fedele — {order.customerOrderCount}° ordine
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">
              Progressivo ordine: {order.sellyErpOrderId || order.orderNumber}
              {order.customerOrderCount >= 4 && " · Valutare sample bonus"}
            </div>
          </div>
        </div>
      )}
  </>
);
