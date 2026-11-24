import React, { useState } from "react";
import {
  X,
  ShieldAlert,
  KeyRound,
  Lock,
  ArrowRight,
  ShieldCheck,
  Barcode,
} from "lucide-react";
import { Operator } from "../../types/wms";

interface SupervisorPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadOperator?: Operator) => void;
  leadOperators: Operator[];
}

export const SupervisorPinModal: React.FC<SupervisorPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  leadOperators,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();

    // Valid authentication: Master PIN "7429", "9999" or scanning a valid Lead badge (e.g. "TL-01", "TL-1", "TL-001")
    const matchedLead = leadOperators.find(
      (op) =>
        op.operatorCode.toUpperCase() === cleanPin ||
        op.operatorCode.toUpperCase().replace("-", "") === cleanPin ||
        op.operatorCode.toUpperCase().replace("-0", "-") === cleanPin ||
        (op as any).pin === cleanPin,
    );

    const MASTER_PIN = import.meta.env.VITE_SUPERVISOR_PIN || "7429";

    if (
      cleanPin === MASTER_PIN ||
      cleanPin === "9999" ||
      cleanPin === "7429" ||
      matchedLead
    ) {
      const targetLead =
        matchedLead ||
        (leadOperators.length > 0 ? leadOperators[0] : undefined);
      if (targetLead) {
        setError(null);
        setPin("");
        onSuccess(targetLead);
        onClose();
      } else {
        setError(
          "Nessun profilo Team Lead configurato nel sistema. Crea prima un operatore con ruolo Team Lead.",
        );
      }
    } else {
      setError(
        "Credenziali non valide. Inserisci il PIN corretto o scansiona il Badge Team Lead.",
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md shadow-xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Accesso Riservato Team Lead
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Autenticazione richiesta per il pannello direzione
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            L'accesso alle metriche di magazzino, alla gestione del personale e
            alla riconfigurazione delle baie è riservato ai responsabili di
            reparto.
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              PIN Supervisore o Scansione Badge Lead
            </label>
            <div className="relative">
              <KeyRound className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Inserisci PIN o scansiona badge..."
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-norsan-600 focus:bg-white rounded-xl text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans placeholder:font-normal focus:outline-none transition scanner-friendly"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-semibold animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
            <Barcode className="w-4 h-4 text-norsan-700 shrink-0" />
            <span>
              Puoi scansionare direttamente il barcode del badge con il lettore
              ottico.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Sblocca Pannello</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Controllo Accessi RBAC</span>
          </div>
          <span className="text-slate-400">Sicurezza Attiva</span>
        </div>
      </div>
    </div>
  );
};
