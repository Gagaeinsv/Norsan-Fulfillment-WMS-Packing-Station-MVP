import React, { useState, useRef } from "react";
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  PackageCheck,
} from "lucide-react";
import { Order, Product } from "../../types/wms";
import {
  parseSellyOrdersCsv,
  SellyImportResult,
} from "../../services/sellyCsvImporter";

interface SellyCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportOrders: (newOrders: Order[], replaceExisting: boolean) => void;
  catalog: Product[];
}

export const SellyCsvModal: React.FC<SellyCsvModalProps> = ({
  isOpen,
  onClose,
  onImportOrders,
  catalog,
}) => {
  const [, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [parsedResult, setParsedResult] = useState<SellyImportResult | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessCsv = (text: string, name: string = "") => {
    setCsvContent(text);
    if (name) setFileName(name);
    const result = parseSellyOrdersCsv(text, catalog);
    setParsedResult(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.orders.length === 0) return;
    onImportOrders(parsedResult.orders, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200/90 w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-norsan-50 text-norsan-700 border border-norsan-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Import Ordini Selly ERP</span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Zero-API · 1-Click CSV
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Esporta gli ordini da Selly ERP in CSV e rilasciali qui per il
                confezionamento immediato.
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
        <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-[#f4f6f9]">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-norsan-500 bg-white hover:bg-norsan-50/40 p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <div className="p-3 bg-slate-50 group-hover:bg-norsan-50 border border-slate-200 text-norsan-700 rounded-2xl mb-3 transition">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-sm font-bold text-slate-900 mb-1">
              Trascina qui il file CSV esportato da Selly ERP o clicca per
              sfogliare
            </div>
            <div className="text-xs text-slate-500 max-w-md">
              Supporta formati italiani con punto e virgola (
              <code className="text-norsan-700 font-mono font-semibold">;</code>
              ), virgola (
              <code className="text-norsan-700 font-mono font-semibold">,</code>
              ) e filtro automatico spese di spedizione.
            </div>
            {fileName && (
              <div className="mt-3 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-mono font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>File caricato: {fileName}</span>
              </div>
            )}
          </div>

          {/* Preview Section */}
          {parsedResult && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 text-center shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Ordini
                  </div>
                  <div className="text-xl font-mono font-bold text-norsan-700 tabular-nums mt-0.5">
                    {parsedResult.summary.totalOrders}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 text-center shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Totale Pezzi
                  </div>
                  <div className="text-xl font-mono font-bold text-emerald-600 tabular-nums mt-0.5">
                    {parsedResult.summary.totalItems}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 text-center shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Righe Servizi Escluse
                  </div>
                  <div className="text-xl font-mono font-bold text-amber-600 tabular-nums mt-0.5">
                    {parsedResult.summary.skippedServiceRows}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 text-center shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Righe Totali
                  </div>
                  <div className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                    {parsedResult.summary.totalRows}
                  </div>
                </div>
              </div>

              {/* Errors / Warnings */}
              {parsedResult.errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {parsedResult.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Table */}
              <div className="border border-slate-200/90 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700 font-sans">
                  <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Ordine</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">Città</th>
                      <th className="p-2.5">Articoli</th>
                      <th className="p-2.5">Corriere</th>
                      <th className="p-2.5">Scatola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedResult.orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/70">
                        <td className="p-2.5 font-mono font-bold text-norsan-700">
                          {ord.orderNumber}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900">
                          {ord.customerName}
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {ord.customerCity} ({ord.customerProvince})
                        </td>
                        <td className="p-2.5 tabular-nums">
                          <span className="font-mono font-bold text-emerald-700">
                            {ord.items.reduce(
                              (s, i) => s + i.quantityRequired,
                              0,
                            )}{" "}
                            pz
                          </span>
                          <span className="text-slate-400 text-[10px] ml-1.5 font-mono">
                            ({ord.items.map((i) => i.product.sku).join(", ")})
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-amber-700 font-medium">
                          {ord.courier}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600 font-medium">
                          {ord.boxRecommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="rounded border-slate-300 text-norsan-700 focus:ring-norsan-500 cursor-pointer"
            />
            <span>Sostituisci completamente la coda ordini attuale</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 bg-white border border-slate-200 rounded-xl transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parsedResult || parsedResult.orders.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed tabular-nums"
            >
              <PackageCheck className="w-4 h-4" />
              <span>
                Carica {parsedResult?.orders.length || 0} Ordini nella Postazione
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
