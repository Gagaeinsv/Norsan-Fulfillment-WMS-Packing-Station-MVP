import React, { useState } from "react";
import { X, AlertOctagon, Check } from "lucide-react";
import { Order } from "../../types/wms";

interface IssueReportModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSubmitIssue: (issueType: string, note: string) => void;
}

export const IssueReportModal: React.FC<IssueReportModalProps> = ({
  order,
  isOpen,
  onClose,
  onSubmitIssue,
}) => {
  const [selectedType, setSelectedType] = useState("damaged_glass");
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitIssue(selectedType, note);
    onClose();
  };

  const issueTypes = [
    {
      id: "damaged_glass",
      label: "Bottiglia in vetro rotta / sigillo danneggiato",
      desc: "Sostituzione immediata del flacone per sicurezza",
    },
    {
      id: "missing_stock",
      label: "Scorta esaurita sullo scaffale (Slot vuoto)",
      desc: "Richiesta rifornimento celere dal magazzino centrale",
    },
    {
      id: "order_discrepancy",
      label: "Discrepanza nel foglio d'ordine stampato",
      desc: "Incongruenza tra articoli fisici e foglio cartaceo",
    },
    {
      id: "call_team_lead",
      label: "Richiedi assistenza Team Leader alla postazione",
      desc: "Supporto diretto del caposquadra",
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Segnalazione Anomalia Postazione
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Riferimento Ordine:{" "}
                <strong className="font-mono text-norsan-700">
                  {order.orderNumber}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[#f4f6f9]">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Tipo di problema riscontrato
            </label>
            <div className="space-y-2">
              {issueTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    selectedType === type.id
                      ? "bg-rose-50/70 border-rose-400 text-rose-950"
                      : "bg-white border-slate-200/90 hover:border-slate-300 text-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    checked={selectedType === type.id}
                    onChange={() => setSelectedType(type.id)}
                    className="mt-1 accent-rose-600 cursor-pointer"
                  />
                  <div>
                    <div className="font-semibold text-xs text-slate-900">
                      {type.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {type.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Note aggiuntive per il Team Leader
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Descrivi brevemente lo stato o la posizione dello scaffale (es: Slot S2-A esaurito)..."
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Invia Segnalazione</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
