import React, { useState } from "react";
import {
  X,
  Barcode,
  Sparkles,
  AlertTriangle,
  FileText,
  Box,
  CornerDownLeft,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Globe,
  BookOpen,
  Package,
} from "lucide-react";
import { Order, Operator } from "../../types/wms";
import { NORSAN_PRODUCTS, MARKETING_FLYERS } from "../../data/norsanProducts";

interface BarcodeSimulatorProps {
  orders: Order[];
  activeOrder: Order | null;
  operators: Operator[];
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onSimulateIncomingWebOrder: () => void;
}

export const BarcodeSimulator: React.FC<BarcodeSimulatorProps> = ({
  orders,
  activeOrder,
  operators,
  isOpen,
  onClose,
  onScan,
  onSimulateIncomingWebOrder,
}) => {
  const [customInput, setCustomInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onScan(customInput.trim());
      setCustomInput("");
    }
  };

  // Find products that are NOT in the active order to test error handling
  const activeProductIds = new Set(
    activeOrder?.items.map((it) => it.product.id) || [],
  );
  const wrongProducts = NORSAN_PRODUCTS.filter(
    (p) => !activeProductIds.has(p.id),
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden transition-all duration-200 select-none">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-norsan-700 text-white rounded-lg flex items-center justify-center shrink-0">
            <Barcode className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold flex items-center gap-2">
              <span>Simulatore Pistola Scanner</span>
              <span className="text-[10px] bg-white/15 text-slate-200 px-2 py-0.2 rounded-md font-mono font-medium">
                Virtual Wedge
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              Clicca per simulare la lettura di codici a barre
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={isMinimized ? "Espandi" : "Riduci"}
          >
            {isMinimized ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Chiudi simulatore"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto bg-[#f4f6f9]">
          {/* Custom Text / Barcode Input */}
          <form onSubmit={handleCustomSubmit} className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Inserimento Manuale / Tastiera</span>
              <span className="text-[10px] text-slate-400 font-mono normal-case">
                Simula + Enter
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Es: OP-042 o BOX-NOR-M o FLY-NOR-ITA"
                className="scanner-friendly flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-norsan-600"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-norsan-700 hover:bg-norsan-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <span>Scan</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Section 0: Operator Badges */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-norsan-600" />
              <span>Scan Badge Operatore</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {operators.map((op) => (
                <button
                  type="button"
                  key={op.id}
                  onClick={() => onScan(op.operatorCode)}
                  className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {op.name}
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-norsan-700">
                      {op.operatorCode}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    Login
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Ingest Live Order from Web */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-norsan-600" />
              <span>E-Commerce Paperless Ingestion</span>
            </div>
            <button
              type="button"
              onClick={onSimulateIncomingWebOrder}
              className="w-full p-2.5 bg-norsan-700 hover:bg-norsan-800 text-white rounded-xl text-left text-xs font-semibold transition active:scale-95 flex items-center justify-between cursor-pointer"
            >
              <span>+ Ricevi Nuovo Ordine Online da norsan.it</span>
              <span className="text-[10px] bg-amber-300 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                LIVE
              </span>
            </button>
          </div>

          {/* Section 2: Orders in Queue (With Brands) */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-norsan-600" />
              <span>Fogli Ordine (3 Canali di Vendita)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {orders.map((ord) => (
                <button
                  type="button"
                  key={ord.id}
                  onClick={() => onScan(ord.barcode)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition active:scale-95 cursor-pointer ${
                    activeOrder?.id === ord.id
                      ? "bg-norsan-50/70 border-norsan-500 text-slate-900"
                      : "bg-white border-slate-200/90 hover:border-slate-300 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-norsan-800 truncate">
                      {ord.orderNumber}
                    </span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                      {ord.source
                        .replace(" Marketplace", "")
                        .replace(" Web Shop", "")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {ord.customerName}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Expected Products for Active Order */}
          {activeOrder && (
            <div>
              <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Articoli Richiesti nell'Ordine Attivo</span>
              </div>
              <div className="space-y-1.5">
                {activeOrder.items.map((item) => (
                  <button
                    type="button"
                    key={item.product.id}
                    onClick={() => onScan(item.product.ean)}
                    className="w-full p-2.5 bg-white hover:bg-emerald-50/60 border border-emerald-200 hover:border-emerald-300 rounded-xl flex items-center justify-between text-left transition active:scale-95 text-xs cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 font-semibold">
                        EAN: {item.product.ean} · Pos: {item.product.shelfLocation}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 text-white shrink-0 ml-2">
                      +1 Scan
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Marketing Flyers Scanning */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-norsan-600" />
              <span>Scan Codici Volantini / Opuscoli</span>
            </div>
            <div className="space-y-1.5">
              {MARKETING_FLYERS.map((flyer) => (
                <button
                  type="button"
                  key={flyer.id}
                  onClick={() => onScan(flyer.code)}
                  className="w-full p-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">
                      {flyer.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {flyer.code} · Pos: {flyer.shelfLocation}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 shrink-0">
                    Scan Flyer
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: 3 Types of Boxes (Branding Categories) */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-amber-600" />
              <span>Scan 3 Tipi di Scatole (Branding)</span>
            </div>
            <div className="space-y-1.5">
              {/* Norsan Box */}
              <button
                type="button"
                onClick={() => onScan("BOX-NOR-M")}
                className="w-full p-2.5 bg-white hover:bg-norsan-50/50 border border-norsan-200 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    Scatola M · LOGO NORSAN
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    BOX-NOR-M · Per ordini norsan.it
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-norsan-700 text-white">
                  NORSAN
                </span>
              </button>

              {/* ZREEN Box */}
              <button
                type="button"
                onClick={() => onScan("BOX-ZRE-M")}
                className="w-full p-2.5 bg-white hover:bg-emerald-50/50 border border-emerald-200 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    Scatola M · LOGO ZREEN
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    BOX-ZRE-M · Per linea ZREEN Nutraceutica
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                  ZREEN
                </span>
              </button>

              {/* Amazon Neutral Box */}
              <button
                type="button"
                onClick={() => onScan("BOX-AMZ-M")}
                className="w-full p-2.5 bg-white hover:bg-amber-50/60 border border-amber-200 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    Scatola M · NEUTRA SENZA LOGO
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    BOX-AMZ-M · Obbligatorio Amazon
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950">
                  AMAZON
                </span>
              </button>
            </div>
          </div>

          {/* Section 5.5: Bench Command Barcodes */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-norsan-600" />
              <span>Comandi Barcode da Tavolo</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onScan("+COLLO")}
                className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900">+1 Scatola</div>
                  <div className="text-[10px] font-mono text-slate-500">
                    +COLLO
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-slate-900 text-white px-2 py-0.5 rounded-md">
                  SCAN
                </span>
              </button>

              <button
                type="button"
                onClick={() => onScan("PRINT-DHL")}
                className="p-2.5 bg-white hover:bg-amber-50/50 border border-amber-200 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900">Stampa DHL</div>
                  <div className="text-[10px] font-mono text-slate-500">
                    PRINT-DHL
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                  SCAN
                </span>
              </button>
            </div>
          </div>

          {/* Section 6: Error Testing (Wrong Products) */}
          <div>
            <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Test Errori (Prodotto Sbagliato)</span>
            </div>
            <div className="space-y-1.5">
              {wrongProducts.slice(0, 2).map((prod) => (
                <button
                  type="button"
                  key={prod.id}
                  onClick={() => onScan(prod.ean)}
                  className="w-full p-2.5 bg-rose-50/60 hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-left transition active:scale-95 text-xs text-rose-900 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{prod.name}</div>
                    <div className="text-[10px] font-mono text-rose-700">
                      EAN: {prod.ean} (Non in questo ordine)
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-rose-600 text-white shrink-0 ml-2">
                    Test Errore
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
