import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  KeyRound,
  Lock,
  ArrowRight,
  ShieldCheck,
  Barcode
} from 'lucide-react';
import { Operator } from '../types/wms';

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
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();

    // Valid authentication: Master PIN "9999" or scanning a valid Lead badge (e.g. "TL-001")
    const matchedLead = leadOperators.find(
      op => op.operatorCode.toUpperCase() === cleanPin
    );

    const MASTER_PIN = import.meta.env.VITE_SUPERVISOR_PIN || '9999';

    if (cleanPin === MASTER_PIN || matchedLead) {
      const targetLead = matchedLead || (leadOperators.length > 0 ? leadOperators[0] : undefined);
      if (targetLead) {
        setError(null);
        setPin('');
        onSuccess(targetLead);
        onClose();
      } else {
        setError('Nessun profilo Team Lead configurato nel sistema. Crea prima un operatore con ruolo Team Lead.');
      }
    } else {
      setError('Credenziali non valide. Inserisci il PIN corretto o scansiona il Badge Team Lead.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-800 text-purple-200 rounded-2xl border border-purple-600 shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Accesso Riservato Team Lead</h3>
              <p className="text-xs text-purple-200 font-medium">Autenticazione richiesta per il pannello direzione</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600">
            L'accesso alle metriche di magazzino, alla gestione del personale e alla riconfigurazione delle baie è riservato ai responsabili di reparto.
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
              PIN Supervisore o Scansione Badge Lead
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Inserisci PIN o scansiona badge..."
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-purple-600 focus:bg-white rounded-2xl text-base font-mono font-bold text-slate-900 focus:outline-none transition scanner-friendly"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-bold animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
            <Barcode className="w-4 h-4 text-purple-700 flex-shrink-0" />
            <span>Puoi scansionare direttamente il barcode del badge con il lettore ottico.</span>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Sblocca Pannello</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-purple-900 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
            <span>Controllo Accessi Basato sui Ruoli (RBAC)</span>
          </div>
          <span className="text-slate-400">Sicurezza Attiva</span>
        </div>
      </div>
    </div>
  );
};
