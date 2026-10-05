import React from "react";
import { X, UserCheck, Barcode, Shield } from "lucide-react";
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-norsan-100 text-norsan-800 rounded-2xl border border-norsan-300">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Identificazione Operatore Postazione
              </h2>
              <p className="text-xs text-slate-500">
                Scansiona il tuo badge (
                <strong className="font-mono text-norsan-700">OP-XXX</strong>) o
                seleziona il profilo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operators List */}
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto bg-slate-100/50">
          {operators.map((op) => {
            const isCurrent = op.id === currentOperator.id;

            return (
              <div
                key={op.id}
                onClick={() => {
                  onSelectOperator(op);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between gap-4 ${
                  isCurrent
                    ? "bg-cyan-50 border-norsan-600 shadow-sm ring-2 ring-norsan-600/30"
                    : "bg-white border-slate-200 hover:border-slate-400"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={op.avatarUrl}
                    alt={op.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-300"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900 truncate">
                        {op.name}
                      </span>
                      <span className="text-[10px] font-mono font-black bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                        {op.operatorCode}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {op.shift}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      Ruolo:{" "}
                      <strong className="text-slate-800">
                        {op.role === "packer"
                          ? "Operatore Imballaggio"
                          : "Team Leader"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {isCurrent ? (
                    <span className="text-xs font-black text-norsan-800 bg-norsan-100 border border-norsan-300 px-3 py-1.5 rounded-xl">
                      Attivo Ora
                    </span>
                  ) : (
                    <button className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-300 transition">
                      Accedi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer tip */}
        <div className="p-3.5 bg-white border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-norsan-600" />
            <span>Supporto lettura diretta con lettore ottico</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 font-bold">
            <Shield className="w-3.5 h-3.5 text-emerald-600" /> Accesso
            Tracciato
          </div>
        </div>
      </div>
    </div>
  );
};
