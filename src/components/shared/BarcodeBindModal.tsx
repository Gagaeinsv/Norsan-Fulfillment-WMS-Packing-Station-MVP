import React, { useState, useEffect, useMemo } from "react";
import { Barcode, Link2, X, Sparkles, MapPin } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200/90 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col select-none">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">
                Associa Codice a Barre Sconosciuto
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Collega il codice scansionato al catalogo NORSAN per
                riconoscerlo in futuro.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-[#f4f6f9]">
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-800">
              Codice Scansionato dalla Pistola
            </div>
            <div className="text-2xl font-mono font-bold text-amber-950 mt-1 tabular-nums">
              {rawBarcode}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Seleziona il Prodotto Corrispondente
              </label>
              {activeOrderSku && (
                <span className="text-[11px] text-norsan-700 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Pre-selezionato da ordine attivo</span>
                </span>
              )}
            </div>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-norsan-600 focus:outline-none focus:ring-2 focus:ring-norsan-500/20 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold cursor-pointer"
            >
              {sortedCatalog.map((p) => {
                const isInActiveOrder =
                  activeOrderSkus.includes(p.sku) || p.sku === activeOrderSku;
                return (
                  <option key={p.id} value={p.sku}>
                    {isInActiveOrder ? "[ORDINE ATTIVO] " : ""}[
                    {p.shelfLocation}] {p.name} ({p.sku})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-2xs">
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-12 h-12 object-contain rounded-lg border border-slate-100 bg-slate-50 p-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {selectedProduct.name}
                </div>
                <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Posizione Scaffale:</span>
                  <span className="text-norsan-700 font-bold">
                    {selectedProduct.shelfLocation}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  EAN Primario: {selectedProduct.ean}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 bg-white border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            <span>Salva Associazione e Scansiona</span>
          </button>
        </div>
      </div>
    </div>
  );
};
