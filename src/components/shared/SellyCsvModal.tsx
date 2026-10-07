import React, { useState, useRef } from "react";
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { Order, Product } from "../../types/wms";
import { parseSellyOrdersCsv, SellyImportResult } from "../../services/sellyCsvImporter";

interface SellyCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportOrders: (newOrders: Order[], replaceExisting: boolean) => void;
  catalog: Product[];
}

const SAMPLE_SELLY_CSV = `Numero;Data;Cliente;Indirizzo;Citta;CAP;Prov;Corriere;Codice Articolo;Descrizione;Quantita;Prezzo;Note
ORDVE2026121172;05/10/2026;Ana Martin;Via dell'Indipendenza 12;Bologna;40121;BO;DHL Paket;NOR-TOT-200-LEM;NORSAN Omega-3 Total Limone 200ml;1;27.00;Primo ordine cliente
ORDVE2026121172;05/10/2026;Ana Martin;Via dell'Indipendenza 12;Bologna;40121;BO;DHL Paket;SPED-01;Spedizione Standard DHL;1;0.00;Primo ordine cliente
ORDVE2026121185;05/10/2026;Marco Bianchi;Corso Buenos Aires 42;Milano;20124;MI;DHL Express;NOR-VEG-100-LEM;NORSAN Omega-3 Vegan 100ml;1;24.00;Consegna piano 3
ORDVE2026121190;05/10/2026;Dott. Roberto Rossi;Via Aurelia 145;Roma;00165;RM;DHL Express;NOR-ARK-200-LEM;NORSAN Omega-3 Arktis Limone;2;58.00;URGENTE - Studio Medico
ORDVE2026121190;05/10/2026;Dott. Roberto Rossi;Via Aurelia 145;Roma;00165;RM;DHL Express;NOR-VIT-D3K2-20;Vitamina D3+K2 Gocce 20ml;1;18.00;URGENTE - Studio Medico
`;

export const SellyCsvModal: React.FC<SellyCsvModalProps> = ({
  isOpen,
  onClose,
  onImportOrders,
  catalog,
}) => {
  const [, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [parsedResult, setParsedResult] = useState<SellyImportResult | null>(null);
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

  const handleLoadSample = () => {
    handleProcessCsv(SAMPLE_SELLY_CSV, "esempio_ordini_selly.csv");
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.orders.length === 0) return;
    onImportOrders(parsedResult.orders, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-norsan-600/20 text-norsan-400 border border-norsan-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black text-white flex items-center gap-2">
                <span>Import Ordini Selly ERP</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Zero-API â€¢ 1-Click CSV
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Esporta gli ordini da Selly ERP in CSV (o Excel) e rilasciali qui per il confezionamento immediato.
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
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-norsan-500 bg-slate-950/60 hover:bg-slate-950 p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <div className="p-3 bg-slate-800 group-hover:bg-norsan-600/30 text-norsan-400 rounded-2xl mb-3 transition">
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-sm font-bold text-white mb-1">
              Trascina qui il file CSV esportato da Selly ERP o clicca per sfogliare
            </div>
            <div className="text-xs text-slate-400 max-w-md">
              Supporta formati italiani con punto e virgola (<code className="text-cyan-300 font-mono">;</code>), virgola (<code className="text-cyan-300 font-mono">,</code>) e filtro automatico spese di spedizione.
            </div>
            {fileName && (
              <div className="mt-3 px-3 py-1 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>File caricato: {fileName}</span>
              </div>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Non hai un file a portata di mano?</span>
            <button
              onClick={handleLoadSample}
              className="text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Carica dataset di test Selly
            </button>
          </div>

          {/* Preview Section */}
          {parsedResult && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Ordini</div>
                  <div className="text-xl font-mono font-black text-cyan-400">
                    {parsedResult.summary.totalOrders}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Totale Pezzi</div>
                  <div className="text-xl font-mono font-black text-emerald-400">
                    {parsedResult.summary.totalItems}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Righe Servizi Escluse</div>
                  <div className="text-xl font-mono font-black text-amber-400">
                    {parsedResult.summary.skippedServiceRows}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Righe Totali</div>
                  <div className="text-xl font-mono font-black text-white">
                    {parsedResult.summary.totalRows}
                  </div>
                </div>
              </div>

              {/* Errors / Warnings */}
              {parsedResult.errors.length > 0 && (
                <div className="bg-rose-950/50 border border-rose-500/50 p-3 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    {parsedResult.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300 font-sans">
                  <thead className="bg-slate-950 text-slate-400 font-bold text-[10px] uppercase sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Ordine</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">CittÃ </th>
                      <th className="p-2.5">Articoli</th>
                      <th className="p-2.5">Corriere</th>
                      <th className="p-2.5">Scatola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {parsedResult.orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-cyan-300">{ord.orderNumber}</td>
                        <td className="p-2.5 font-semibold text-white">{ord.customerName}</td>
                        <td className="p-2.5 text-slate-400">{ord.customerCity} ({ord.customerProvince})</td>
                        <td className="p-2.5">
                          <span className="font-mono font-bold text-emerald-400">
                            {ord.items.reduce((s, i) => s + i.quantityRequired, 0)} pz
                          </span>
                          <span className="text-slate-500 text-[10px] ml-1">
                            ({ord.items.map((i) => i.product.sku).join(", ")})
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-amber-300">{ord.courier}</td>
                        <td className="p-2.5 font-mono text-[11px] text-purple-300">{ord.boxRecommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 font-semibold">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-norsan-600 focus:ring-0"
            />
            <span>Sostituisci completamente la coda ordini attuale</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!parsedResult || parsedResult.orders.length === 0}
              className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
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
