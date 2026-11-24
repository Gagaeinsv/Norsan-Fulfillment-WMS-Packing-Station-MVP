/**
 * packing/PackingBanners.tsx
 * All contextual alert banners for the active packing order:
 *   - DHL Workflow Mode Banner
 *   - Amazon Marketplace Neutral Box Banner
 *   - Special Notes (WhatsApp/Telefono)
 *   - Physical Document required (B2B/Print-on-Demand)
 *   - Retention Gift (1st/2nd order marketing gift)
 *   - SellyErp Loyalty badge (repeat customer)
 */

import React from "react";
import {
  AlertOctagon,
  Check,
  Printer,
  Package,
  FileText,
  Gift,
  Utensils,
  ClipboardList,
  Star,
} from "lucide-react";
import { Order } from "../../types/wms";

interface PackingBannersProps {
  order: Order;
  requiresGift: boolean;
  onToggleGift?: () => void;
  onTogglePhysicalDocument?: () => void;
  dhlPrintTiming?: "on_scan" | "on_finish";
}

export const PackingBanners: React.FC<PackingBannersProps> = ({
  order,
  requiresGift,
  onToggleGift,
  onTogglePhysicalDocument,
  dhlPrintTiming = "on_scan",
}) => (
  <>
    {/* Workflow Mode Banner: Slip Scan -> Immediate DHL Print or On Box Close */}
    <div
      className={`px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 text-xs font-medium border shrink-0 ${
        dhlPrintTiming === "on_scan"
          ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
          : "bg-slate-50 border-slate-200 text-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {dhlPrintTiming === "on_scan" ? (
          <Printer className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <Package className="w-4 h-4 text-norsan-600 shrink-0" />
        )}
        <span className="truncate">
          {dhlPrintTiming === "on_scan"
            ? "Etichetta DHL inviata alla stampante termica · Preleva gli articoli illuminati e applica l'etichetta"
            : "Preleva gli articoli illuminati e componi le scatole · L'etichetta DHL verrà stampata a chiusura"}
        </span>
      </div>
      <span className="font-mono text-[11px] text-slate-700 font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0 tabular-nums">
        DHL EXPRESS · {order.packageCount || 1}{" "}
        {(order.packageCount || 1) === 1 ? "COLLO" : "COLLI"}
      </span>
    </div>

    {/* Amazon Marketplace — Obbligo Scatola Neutra Senza Logo & Esclusiva NORSAN */}
    {(order.source === "Amazon Marketplace" ||
      order.boxBranding === "neutral_unbranded" ||
      order.boxRecommendation?.startsWith("BOX-AMZ")) && (
      <div className="bg-amber-50 text-slate-900 px-3.5 py-2.5 rounded-xl border border-amber-300 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs flex items-center gap-1.5 flex-wrap">
              <span>ORDINE AMAZON — SCATOLA NEUTRA OBBLIGATORIA</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 text-amber-300 rounded font-mono font-semibold">
                NO LOGO
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-norsan-700 text-white rounded font-semibold">
                SOLO PRODOTTI NORSAN
              </span>
            </div>
            <div className="text-xs text-slate-700 mt-0.5">
              Canale Amazon FBM: consentiti <strong>solo prodotti NORSAN</strong>.
              Utilizzare esclusivamente <strong>cartone marrone neutro</strong>{" "}
              (BOX-AMZ) senza loghi né volantini.
            </div>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-[11px] uppercase font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-amber-300 text-slate-800">
            {order.boxRecommendation || "BOX-AMZ-M"}
          </span>
        </div>
      </div>
    )}

    {/* Special Notes — WhatsApp / Telefono */}
    {order.source === "WhatsApp / Telefono" && order.specialNotes && (
      <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 text-amber-950 px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 shrink-0">
        <AlertOctagon className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-bold uppercase tracking-wide">
            Nota Speciale (Ordine Telefonico/WhatsApp)
          </div>
          <div className="font-medium text-amber-900 mt-0.5">
            {order.specialNotes}
          </div>
        </div>
      </div>
    )}

    {/* Physical Document — B2B / Print-on-Demand */}
    {order.requiresPhysicalDocument && (
      <div
        className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 shrink-0 ${
          order.physicalDocumentConfirmed
            ? "bg-emerald-50/70 border-emerald-200"
            : "bg-rose-50 border-rose-300"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              order.physicalDocumentConfirmed
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div
              className={`font-bold text-xs ${
                order.physicalDocumentConfirmed
                  ? "text-emerald-800"
                  : "text-rose-900"
              }`}
            >
              OBBLIGATORIO: Stampare e inserire Fattura / DDT cartaceo
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Richiesta del cliente o documento B2B
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onTogglePhysicalDocument}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
            order.physicalDocumentConfirmed
              ? "bg-emerald-600 text-white"
              : "bg-white border border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          <div
            className={`w-4 h-4 rounded flex items-center justify-center border ${
              order.physicalDocumentConfirmed
                ? "border-emerald-400 bg-emerald-500"
                : "border-slate-300 bg-white"
            }`}
          >
            {order.physicalDocumentConfirmed && (
              <Check className="w-3 h-3 text-white" />
            )}
          </div>
          <span>Documento inserito</span>
        </button>
      </div>
    )}

    {/* Retention Gift */}
    {requiresGift && (
      <div
        className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 shrink-0 ${
          order.giftConfirmed
            ? "bg-emerald-50/70 border-emerald-200"
            : order.retentionGift === "card_discount_15"
              ? "bg-purple-50 border-purple-200"
              : "bg-orange-50 border-orange-200"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              order.giftConfirmed
                ? "bg-emerald-100 text-emerald-700"
                : order.retentionGift === "card_discount_15"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-orange-100 text-orange-700"
            }`}
          >
            {order.retentionGift === "card_discount_15" ? (
              <Gift className="w-4 h-4" />
            ) : order.retentionGift === "branded_spoon" ? (
              <Utensils className="w-4 h-4" />
            ) : (
              <ClipboardList className="w-4 h-4" />
            )}
          </div>
          <div
            className={`font-semibold text-xs ${
              order.giftConfirmed ? "text-emerald-800" : "text-slate-900"
            }`}
          >
            {order.customerOrderCount}° ORDINE:{" "}
            {order.retentionGift === "card_discount_15"
              ? "Inserire Cartolina Sconto -15% (Slot #2)"
              : order.retentionGift === "branded_spoon"
                ? "Inserire Cucchiaio Dosatore NORSAN"
                : "Inserire Volantino Re-test Omegametrix (Slot #3)"}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleGift}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
            order.giftConfirmed
              ? "bg-emerald-600 text-white"
              : "bg-white border border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          <div
            className={`w-4 h-4 rounded flex items-center justify-center border ${
              order.giftConfirmed
                ? "border-emerald-400 bg-emerald-500"
                : "border-slate-300 bg-white"
            }`}
          >
            {order.giftConfirmed && <Check className="w-3 h-3 text-white" />}
          </div>
          <span>Ho inserito l'omaggio nel pacco</span>
        </button>
      </div>
    )}

    {/* SellyErp Loyalty Badge */}
    {(order.source === "SellyErp INT" || order.source === "SellyErp ORDVE") &&
      order.customerOrderCount > 1 && (
        <div className="bg-amber-50/80 border border-amber-200 border-l-4 border-l-amber-400 text-amber-950 px-3.5 py-2 rounded-xl flex items-center gap-2.5 shrink-0">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="text-xs flex items-center gap-2 flex-wrap">
            <span className="font-bold">
              Cliente Fedele — {order.customerOrderCount}° ordine
            </span>
            <span className="text-slate-600">
              Progressivo: {order.sellyErpOrderId || order.orderNumber}
              {order.customerOrderCount >= 4 && " · Valutare sample bonus"}
            </span>
          </div>
        </div>
      )}
  </>
);
