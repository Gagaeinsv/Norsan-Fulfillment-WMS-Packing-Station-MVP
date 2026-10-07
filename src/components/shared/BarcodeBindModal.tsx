import React, { useState, useEffect, useMemo } from "react";
import { Barcode, Link2, X, Sparkles } from "lucide-react";
import { Product } from "../../types/wms";

interface BarcodeBindModalProps {
  isOpen: boolean;
  rawBarcode: string;
  onClose: () => void;
  onBind: (barcode: string, selectedSku: string) => void;
  catalog: Product[];
  activeOrderSku?: string;
  activeOrderSkus?: string[];
}

export const BarcodeBindModal: React.FC<BarcodeBindModalProps> = ({
  isOpen,
  rawBarcode,
  onClose,
  onBind,
  catalog,
  activeOrderSku,
  activeOrderSkus = [],
}) => {
  const defaultSku = useMemo(() => {
    if (activeOrderSku && catalog.some((p) => p.sku === activeOrderSku)) {
      return activeOrderSku;
    }
    const matchingOrderSku = activeOrderSkus.find((sku) =>
      catalog.some((p) => p.sku === sku),
    );
    if (matchingOrderSku) return matchingOrderSku;
    return catalog[0]?.sku || "NOR-TOT-200-LEM";
  }, [activeOrderSku, activeOrderSkus, catalog]);

  const [selectedSku, setSelectedSku] = useState<string>(defaultSku);

  // When modal opens or activeOrderSku changes, always default to the active order's product!
  useEffect(() => {
    if (isOpen) {
      setSelectedSku(defaultSku);
    }
  }, [isOpen, defaultSku]);

  // Sort catalog so products in the active order appear at the top
  const sortedCatalog = useMemo(() => {
    const activeSet = new Set(
      activeOrderSkus.length > 0
        ? activeOrderSkus
        : activeOrderSku
          ? [activeOrderSku]
          : [],
    );
    return [...catalog].sort((a, b) => {
      const aInOrder = activeSet.has(a.sku) ? 1 : 0;
      const bInOrder = activeSet.has(b.sku) ? 1 : 0;
      if (aInOrder !== bInOrder) return bInOrder - aInOrder;
      return a.name.localeCompare(b.name);
    });
  }, [catalog, activeOrderSku, activeOrderSkus]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!rawBarcode || !selectedSku) return;
    onBind(rawBarcode, selectedSku);
    onClose();
  };

  const selectedProduct = catalog.find((p) => p.sku === selectedSku);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Barcode className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black text-white">
                Associa Codice a Barre Sconosciuto
              </div>
              <div className="text-xs text-slate-400">
                Collega il codice scansionato al catalogo NORSAN per riconoscerlo per sempre.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Codice Scansionato dalla Pistola
            </div>
            <div className="text-2xl font-mono font-black text-amber-400 mt-1">
              {rawBarcode}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300">
                Seleziona il Prodotto Corrispondente:
              </label>
              {activeOrderSku && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Pre-selezionato da ordine attivo
                </span>
              )}
            </div>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full bg-slate-950 border-2 border-amber-500/70 focus:border-amber-400 rounded-xl p-3 text-sm text-white font-bold cursor-pointer"
            >
              {sortedCatalog.map((p) => {
                const isInActiveOrder =
                  activeOrderSkus.includes(p.sku) || p.sku === activeOrderSku;
                return (
                  <option key={p.id} value={p.sku}>
                    {isInActiveOrder ? "⭐ [ORDINE ATTIVO] " : ""}
                    [{p.shelfLocation}] {p.name} ({p.sku})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-3">
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-12 h-12 object-cover rounded-lg border border-slate-600 flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {selectedProduct.name}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Posizione Scaffale:{" "}
                  <span className="text-amber-400 font-bold">
                    [{selectedProduct.shelfLocation}]
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  EAN Primario: {selectedProduct.ean}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            <span>Salva Associazione e Scansiona</span>
          </button>
        </div>
      </div>
    </div>
  );
};
