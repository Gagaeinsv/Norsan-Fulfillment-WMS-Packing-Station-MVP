import React, { useState } from 'react';
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
  BookOpen
} from 'lucide-react';
import { Order, Operator } from '../../types/wms';
import { NORSAN_PRODUCTS, MARKETING_FLYERS } from '../../data/norsanProducts';

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
  const [customInput, setCustomInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onScan(customInput.trim());
      setCustomInput('');
    }
  };

  // Find products that are NOT in the active order to test error handling
  const activeProductIds = new Set(activeOrder?.items.map(it => it.product.id) || []);
  const wrongProducts = NORSAN_PRODUCTS.filter(p => !activeProductIds.has(p.id));

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md bg-white border-2 border-norsan-600 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 select-none">
      {/* Header */}
      <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-norsan-600 text-white rounded-xl">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black flex items-center gap-1.5">
              Simulatore Pistola Scanner
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
                Virtual Wedge
              </span>
            </h3>
            <p className="text-[10px] text-slate-300">
              Clicca per simulare la lettura di codici a barre
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            title={isMinimized ? "Espandi" : "Riduci"}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            title="Chiudi simulatore"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto bg-slate-50">
          {/* Custom Text / Barcode Input */}
          <form onSubmit={handleCustomSubmit} className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Inserimento Manuale / Tastiera</span>
              <span className="text-[10px] text-slate-500 font-mono">Simula + Enter</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Es: OP-042 o BOX-NOR-M o FLY-NOR-ITA"
                className="scanner-friendly flex-1 bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-norsan-600 shadow-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-norsan-600 hover:bg-norsan-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition active:scale-95 shadow-sm"
              >
                <span>Skan</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Section 0: Operator Badges */}
          <div>
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-norsan-600" />
              <span>Skan Badge Operatore</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {operators.map(op => (
                <button
                  key={op.id}
                  onClick={() => onScan(op.operatorCode)}
                  className="p-2 bg-white hover:bg-slate-100 border-2 border-slate-200 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between shadow-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{op.name}</div>
                    <div className="text-[10px] font-mono font-bold text-norsan-700">{op.operatorCode}</div>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                    Login
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Ingest Live Order from Web */}
          <div>
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-600" />
              <span>E-Commerce Paperless Ingestion</span>
            </div>
            <button
              onClick={onSimulateIncomingWebOrder}
              className="w-full p-2.5 bg-gradient-to-r from-cyan-600 to-norsan-600 hover:from-cyan-700 hover:to-norsan-700 text-white rounded-xl text-left text-xs font-bold transition active:scale-95 flex items-center justify-between shadow-sm"
            >
              <span>+ Ricevi Nuovo Ordine Online da norsan.it</span>
              <span className="text-[10px] bg-yellow-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                LIVE
              </span>
            </button>
          </div>

          {/* Section 2: Orders in Queue (With Brands) */}
          <div>
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-norsan-600" />
              <span>Fogli Ordine (3 Canali di Vendita)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {orders.map(ord => (
                <button
                  key={ord.id}
                  onClick={() => onScan(ord.barcode)}
                  className={`p-2.5 rounded-xl border-2 text-left text-xs transition active:scale-95 shadow-xs ${
                    activeOrder?.id === ord.id
                      ? 'bg-cyan-50 border-norsan-600 text-slate-900 ring-2 ring-norsan-600/30'
                      : 'bg-white border-slate-200 hover:border-slate-400 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-norsan-800">{ord.orderNumber}</span>
                    <span className="text-[9px] font-bold px-1 rounded bg-slate-100 text-slate-700">
                      {ord.source.replace(' Marketplace', '').replace(' Web Shop', '')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{ord.customerName}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Expected Products for Active Order */}
          {activeOrder && (
            <div>
              <div className="text-[11px] font-black text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Articoli Richiesti nell'Ordine Attivo</span>
              </div>
              <div className="space-y-1.5">
                {activeOrder.items.map(item => (
                  <button
                    key={item.product.id}
                    onClick={() => onScan(item.product.ean)}
                    className="w-full p-2.5 bg-white hover:bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between text-left transition active:scale-95 text-xs shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">{item.product.name}</div>
                      <div className="text-[10px] font-mono text-emerald-800 font-bold">
                        EAN: {item.product.ean} • Pos: [{item.product.shelfLocation}]
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-black px-2.5 py-1 rounded-lg bg-emerald-600 text-white flex-shrink-0 ml-2">
                      +1 Skan
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Marketing Flyers Scanning */}
          <div>
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-norsan-600" />
              <span>Skan Codici Volantini / Opuscoli</span>
            </div>
            <div className="space-y-1.5">
              {MARKETING_FLYERS.map(flyer => (
                <button
                  key={flyer.id}
                  onClick={() => onScan(flyer.code)}
                  className="w-full p-2 bg-white hover:bg-slate-100 border-2 border-slate-200 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{flyer.title}</div>
                    <div className="text-[10px] font-mono text-slate-500">{flyer.code} • Pos: [{flyer.shelfLocation}]</div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Skan Flyer
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: 3 Types of Boxes (Branding Categories) */}
          <div>
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-amber-600" />
              <span>Skan 3 Tipi di Scatole (Branding)</span>
            </div>
            <div className="space-y-1.5">
              {/* Norsan Box */}
              <button
                onClick={() => onScan('BOX-NOR-M')}
                className="w-full p-2 bg-cyan-50 hover:bg-cyan-100 border-2 border-norsan-400 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-norsan-950">Scatola M • LOGO NORSAN</div>
                  <div className="text-[10px] font-mono text-norsan-800">BOX-NOR-M • Per ordini norsan.it</div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-norsan-600 text-white">NORSAN</span>
              </button>

              {/* ZREEN Box */}
              <button
                onClick={() => onScan('BOX-ZRE-M')}
                className="w-full p-2 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-400 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-emerald-950">Scatola M • LOGO ZREEN (Docciaria)</div>
                  <div className="text-[10px] font-mono text-emerald-800">BOX-ZRE-M • Per linea ZREEN Nutraceutica</div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-700 text-white">ZREEN</span>
              </button>

              {/* Amazon Neutral Box */}
              <button
                onClick={() => onScan('BOX-AMZ-M')}
                className="w-full p-2 bg-amber-50 hover:bg-amber-100 border-2 border-amber-400 rounded-xl text-left text-xs transition active:scale-95 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-amber-950">Scatola M • NEUTRA SENZA LOGO</div>
                  <div className="text-[10px] font-mono text-amber-800">BOX-AMZ-M • Obbligatorio Amazon</div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-600 text-white">AMAZON</span>
              </button>
            </div>
          </div>

          {/* Section 6: Error Testing (Wrong Products) */}
          <div>
            <div className="text-[11px] font-black text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Test Errori (Scansiona Prodotto Sbagliato)</span>
            </div>
            <div className="space-y-1.5">
              {wrongProducts.slice(0, 2).map(prod => (
                <button
                  key={prod.id}
                  onClick={() => onScan(prod.ean)}
                  className="w-full p-2 bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 rounded-xl flex items-center justify-between text-left transition active:scale-95 text-xs text-rose-900 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{prod.name}</div>
                    <div className="text-[10px] font-mono text-rose-700">EAN: {prod.ean} (Non in questo ordine)</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-rose-600 text-white flex-shrink-0 ml-2">
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
