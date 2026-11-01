import React, { useState } from "react";
import {
  X,
  UserCheck,
  Barcode,
  Shield,
  KeyRound,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { Operator } from "../../types/wms";

interface OperatorAuthModalProps {
  operators: Operator[];
  currentOperator: Operator;
  isOpen: boolean;
  onClose: () => void;
  onSelectOperator: (operator: Operator) => void;
}

export const OperatorAuthModal: React.FC<OperatorAuthModalProps> = ({
  operators,
  currentOperator,
  isOpen,
  onClose,
  onSelectOperator,
}) => {
  const [authCode, setAuthCode] = useState("");
  const [selectedTargetOp, setSelectedTargetOp] = useState<Operator | null>(null);
  const [targetPin, setTargetPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScanOrCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = authCode.trim().toUpperCase();
    if (!clean) return;

    const matched = operators.find((op) => {
      const opCode = op.operatorCode.toUpperCase();
      const opPin = (op as any).pin ? (op as any).pin.toString().trim() : "";
      if (opCode === clean) return true;
      if (opCode.replace("-", "") === clean) return true;
      if (clean === opCode.replace("-0", "-")) return true;
      const numPart = opCode.replace(/[^0-9]/g, "");
      if (numPart && (clean === numPart || clean === numPart.replace(/^0+/, ""))) {
        if (op.role !== "team_lead") return true;
      }
      if (opPin && opPin === clean) return true;
      return false;
    });

    if (matched) {
      if (matched.id === currentOperator.id) {
        setErrorMsg("Questo operatore è già attualmente attivo sulla postazione.");
        return;
      }
      setErrorMsg(null);
      setSuccessMsg(`Autenticato: ${matched.name} [${matched.operatorCode}]`);
      setTimeout(() => {
        onSelectOperator(matched);
        onClose();
      }, 400);
    } else {
      setErrorMsg(`Badge o PIN [${clean}] non valido. Scansione non riconosciuta.`);
    }
  };

  const handlePinConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetOp) return;

    const cleanPin = targetPin.trim();
    const opPin = (selectedTargetOp as any).pin
      ? (selectedTargetOp as any).pin.toString().trim()
      : "";

    // Allow validation by personal PIN or Master Supervisor PIN (7429 / 9999)
    if (cleanPin === opPin || cleanPin === "7429" || cleanPin === "9999") {
      setErrorMsg(null);
      setSuccessMsg(`Passaggio consegne confermato a ${selectedTargetOp.name}`);
      setTimeout(() => {
        onSelectOperator(selectedTargetOp);
        onClose();
      }, 400);
    } else {
      setErrorMsg(`PIN errato per ${selectedTargetOp.name}. Operazione negata.`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-100 text-cyan-800 rounded-2xl border border-cyan-300">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Cambio Turno / Autenticazione Operatore
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Scansiona il badge o inserisci il PIN dell'operatore subentrante
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Operator Banner */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={currentOperator.avatarUrl}
              alt={currentOperator.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-cyan-600"
            />
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                Operatore Attualmente Connesso
              </div>
              <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>{currentOperator.name}</span>
                <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-300">
                  {currentOperator.operatorCode}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-300 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            In Servizio
          </span>
        </div>

        {/* Form: Scan or Type Code */}
        <div className="p-5">
          {!selectedTargetOp ? (
            <form onSubmit={handleScanOrCodeSubmit} className="space-y-4">
              <label className="block text-xs font-black uppercase text-slate-700">
                Scansione Badge (OP-01, OP-02, TL-01...) o Codice Personale
              </label>
              <div className="relative">
                <Barcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600" />
                <input
                  type="text"
                  placeholder="Scansiona badge con pistola o digita codice..."
                  value={authCode}
                  onChange={(e) => {
                    setAuthCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full pl-11 pr-24 py-3 bg-slate-50 border-2 border-slate-300 focus:border-cyan-600 focus:bg-white rounded-2xl text-sm font-mono font-black text-slate-900 placeholder:text-slate-400 focus:outline-none transition scanner-friendly"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-xl transition active:scale-95 shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Verifica</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Authorized Staff Directory for Reference (Requires PIN upon tap) */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                  <span>Personale Abilitato su questa Baia ({operators.length})</span>
                  <span className="text-[10px] text-slate-400 font-mono">Richiede PIN per conferma</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {operators.map((op) => {
                    const isCurrent = op.id === currentOperator.id;
                    return (
                      <div
                        key={op.id}
                        onClick={() => {
                          if (isCurrent) return;
                          setSelectedTargetOp(op);
                          setTargetPin("");
                          setErrorMsg(null);
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition ${
                          isCurrent
                            ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                            : "bg-white hover:bg-slate-50 border-slate-300 hover:border-cyan-500 cursor-pointer shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={op.avatarUrl}
                            alt={op.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-300 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {op.name}
                            </div>
                            <div className="text-[10px] font-mono font-bold text-slate-500">
                              {op.operatorCode}
                            </div>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                            Attivo
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-lg">
                            Passa a ➔
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>
          ) : (
            /* PIN Confirmation Screen when profile was selected */
            <form onSubmit={handlePinConfirmSubmit} className="space-y-4">
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTargetOp.avatarUrl}
                    alt={selectedTargetOp.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-cyan-600"
                  />
                  <div>
                    <div className="text-xs text-slate-500 font-bold">Operatore Subentrante</div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>{selectedTargetOp.name}</span>
                      <span className="font-mono text-xs text-cyan-800 font-bold bg-white px-2 py-0.5 rounded border border-cyan-300">
                        {selectedTargetOp.operatorCode}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTargetOp(null);
                    setErrorMsg(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-white border border-slate-300 rounded-xl"
                >
                  Annulla
                </button>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Inserisci il PIN Personale di {selectedTargetOp.name}
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600" />
                  <input
                    type="password"
                    placeholder="PIN a 4 cifre..."
                    value={targetPin}
                    onChange={(e) => {
                      setTargetPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    maxLength={6}
                    className="w-full pl-11 pr-24 py-3 bg-slate-50 border-2 border-slate-300 focus:border-cyan-600 focus:bg-white rounded-2xl text-base font-mono font-black text-slate-900 placeholder:text-slate-400 focus:outline-none transition tracking-widest text-center"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-xl transition active:scale-95 shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Conferma</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Feedback messages */}
          {successMsg && (
            <div className="mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 px-4 py-2.5 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-cyan-600" />
            <span>Lettore barcode attivo • Scansione badge garantita</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 font-bold">
            <Shield className="w-3.5 h-3.5 text-emerald-600" /> Autenticazione Obbligatoria
          </div>
        </div>
      </div>
    </div>
  );
};
