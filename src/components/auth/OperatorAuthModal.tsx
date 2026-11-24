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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-norsan-50 text-norsan-700 rounded-xl border border-norsan-200 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cambio Turno / Autenticazione Operatore
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Scansiona il badge o inserisci il PIN dell'operatore subentrante
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

        {/* Current Active Operator Banner */}
        <div className="px-5 py-3 bg-[#f4f6f9] border-b border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={currentOperator.avatarUrl}
              alt={currentOperator.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-300 bg-white"
            />
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Operatore Attivo
              </div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{currentOperator.name}</span>
                <span className="font-mono text-xs font-semibold text-norsan-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {currentOperator.operatorCode}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>In Servizio</span>
          </span>
        </div>

        {/* Form: Scan or Type Code */}
        <div className="p-5">
          {!selectedTargetOp ? (
            <form onSubmit={handleScanOrCodeSubmit} className="space-y-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Scansione Badge (OP-01, OP-02, TL-01) o Codice Personale
              </label>
              <div className="relative">
                <Barcode className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-norsan-600" />
                <input
                  type="text"
                  placeholder="Scansiona badge con pistola o digita codice..."
                  value={authCode}
                  onChange={(e) => {
                    setAuthCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-300 focus:border-norsan-600 focus:bg-white rounded-xl text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none transition scanner-friendly"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-norsan-700 hover:bg-norsan-800 text-white font-semibold text-xs rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>Verifica</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Authorized Staff Directory for Reference (Requires PIN upon tap) */}
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                  <span>
                    Personale Abilitato ({operators.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono normal-case">
                    Richiede PIN per conferma
                  </span>
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
                            : "bg-white hover:bg-slate-50 border-slate-200/90 hover:border-norsan-400 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={op.avatarUrl}
                            alt={op.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {op.name}
                            </div>
                            <div className="text-[10px] font-mono font-semibold text-slate-500">
                              {op.operatorCode}
                            </div>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Attivo
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-norsan-700 bg-norsan-50 border border-norsan-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 shrink-0">
                            <span>Seleziona</span>
                            <ArrowRight className="w-3 h-3" />
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
              <div className="p-3 bg-norsan-50/70 border border-norsan-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTargetOp.avatarUrl}
                    alt={selectedTargetOp.name}
                    className="w-10 h-10 rounded-full object-cover border border-norsan-300"
                  />
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      Operatore Subentrante
                    </div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{selectedTargetOp.name}</span>
                      <span className="font-mono text-xs text-norsan-800 font-semibold bg-white px-2 py-0.5 rounded-md border border-norsan-200">
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
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 bg-white border border-slate-200 rounded-xl cursor-pointer"
                >
                  Indietro
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Inserisci il PIN Personale di {selectedTargetOp.name}
                </label>
                <div className="relative">
                  <KeyRound className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-norsan-600" />
                  <input
                    type="password"
                    placeholder="PIN a 4 cifre..."
                    value={targetPin}
                    onChange={(e) => {
                      setTargetPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    maxLength={6}
                    className="w-full pl-10 pr-28 py-2.5 bg-slate-50 border border-slate-300 focus:border-norsan-600 focus:bg-white rounded-xl text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition tracking-widest text-center"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
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
            <div className="mt-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-norsan-600" />
            <span>Lettore barcode attivo · Scansione badge garantita</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 font-semibold">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Autenticazione Obbligatoria</span>
          </div>
        </div>
      </div>
    </div>
  );
};
