import React, { useState } from "react";
import {
  Lock,
  Barcode,
  ShieldCheck,
  Package,
  ArrowRight,
  ShieldAlert,
  KeyRound,
  QrCode,
  Delete,
  CheckCircle2,
  ScanBarcode,
} from "lucide-react";
import { Operator } from "../../types/wms";

interface TerminalLockScreenProps {
  operators: Operator[];
  onLogin: (operator: Operator) => void;
}

export const TerminalLockScreen: React.FC<TerminalLockScreenProps> = ({
  operators,
  onLogin,
}) => {
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const performLogin = (codeToTest: string) => {
    const clean = codeToTest.trim().toUpperCase();
    if (!clean) return;

    // Match by Operator Code (OP-01, OP-02, TL-01...), alias or personal PIN
    const matched = operators.find((op) => {
      const opCode = op.operatorCode.toUpperCase();
      const opPin = (op as any).pin ? (op as any).pin.toString().trim() : "";

      // 1. Exact match e.g. "OP-01", "TL-01", "OP-02"
      if (opCode === clean) return true;

      // 2. Match without hyphen e.g. "OP01", "TL01", "OP02"
      if (opCode.replace("-", "") === clean) return true;

      // 3. Match flexible single digit / without leading zero e.g. "OP-1" -> "OP-01", "TL-1" -> "TL-01"
      if (clean === opCode.replace("-0", "-")) return true;

      // 4. Match numeric index for packers e.g. "01" or "1" -> OP-01, "02" or "2" -> OP-02
      const numPart = opCode.replace(/[^0-9]/g, "");
      if (
        numPart &&
        (clean === numPart || clean === numPart.replace(/^0+/, ""))
      ) {
        if (op.role !== "team_lead") return true;
      }

      // 5. Match personal PIN e.g. "0001", "0002", "7429"
      if (opPin && opPin === clean) return true;

      return false;
    });

    if (matched) {
      setErrorMsg(null);
      setSuccessName(matched.name);
      setTimeout(() => {
        onLogin(matched);
      }, 350);
    } else {
      setErrorMsg(
        `Badge / PIN non riconosciuto: [${clean}]. Scansiona un badge autorizzato.`,
      );
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(inputCode);
  };

  const handleKeypadPress = (val: string) => {
    setErrorMsg(null);
    setInputCode((prev) => prev + val);
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setInputCode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg(null);
    setInputCode("");
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex flex-col items-center justify-between p-4 md:p-6 select-none">
      {/* Top Header Branding */}
      <header className="w-full max-w-4xl flex items-center justify-between pt-1 pb-4 border-b border-slate-200/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-norsan-700 text-white rounded-xl shadow-2xs flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">
                NORSAN
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-norsan-700 font-mono text-xs font-semibold uppercase tracking-wider">
                ZREEN Nutraceutica
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              WMS Packaging Terminal · Hub Bolzano (BZ)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Sicurezza Attiva</span>
        </div>
      </header>

      {/* Main Authentication Box */}
      <main className="w-full max-w-md my-auto flex flex-col items-center bg-white border border-slate-200/90 rounded-3xl p-6 md:p-7 shadow-sm">
        {/* Clean Scanner Lock Icon Badge */}
        <div className="relative mb-5 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-norsan-50 border border-norsan-200 flex items-center justify-center">
            <Barcode className="w-8 h-8 text-norsan-700" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-white border border-slate-200 rounded-full text-norsan-700 shadow-xs">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-center text-slate-900">
          Postazione Bloccata
        </h1>
        <p className="text-xs text-slate-500 text-center max-w-xs mt-1.5 leading-relaxed">
          Scansiona il tuo{" "}
          <strong className="text-norsan-700 font-mono font-semibold">
            Badge (OP-01, OP-02, TL-01)
          </strong>{" "}
          con la pistola ottica o digita il codice personale.
        </p>

        {/* Input Barcode / PIN Display */}
        <form onSubmit={handleFormSubmit} className="w-full mt-5">
          <div className="relative">
            <KeyRound className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Scansiona badge o digita codice..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="w-full pl-10 pr-24 py-3 bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-norsan-600 focus:bg-white rounded-xl text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans placeholder:font-normal focus:outline-none transition scanner-friendly tracking-wider text-center"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-norsan-700 hover:bg-norsan-800 text-white font-semibold text-xs rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <span>Accedi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Success / Error Notification */}
        {successName && (
          <div className="mt-3.5 w-full px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Accesso autorizzato: {successName}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3.5 w-full px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-center gap-2 font-semibold animate-shake">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Light Industrial Touchscreen Keypad */}
        <div className="w-full mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-2.5 px-0.5">
            <span className="flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-norsan-600" />
              <span>Tastierino Touchscreen</span>
            </span>
            <span>Digitazione diretta</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKeypadPress(key)}
                className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl font-mono text-lg font-bold text-slate-900 transition active:scale-95 cursor-pointer tabular-nums"
              >
                {key}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="py-3 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl font-mono text-xs font-semibold text-rose-600 transition active:scale-95 cursor-pointer uppercase"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl font-mono text-lg font-bold text-slate-900 transition active:scale-95 cursor-pointer tabular-nums"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-xl flex items-center justify-center text-amber-600 transition active:scale-95 cursor-pointer"
              title="Cancella ultima cifra"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Quick OP Prefix helper */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setInputCode("OP-")}
              className="py-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl font-mono text-xs font-semibold text-slate-700 transition active:scale-95 cursor-pointer"
            >
              Prefisso OP-
            </button>
            <button
              type="button"
              onClick={() => performLogin(inputCode)}
              className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition active:scale-95 cursor-pointer"
            >
              Conferma Invio
            </button>
          </div>
        </div>

        {/* Security Notice: No 1-Click bypass */}
        <div className="mt-5 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-norsan-600" />
          <span>Accesso vincolato a badge personale · Lean 5S</span>
        </div>
      </main>

      {/* Bottom Footer Info */}
      <footer className="w-full max-w-4xl pt-4 border-t border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-4 h-4 text-norsan-600" />
          <span>
            Lettore Barcode USB / Bluetooth sempre attivo in modalità Keyboard
            Wedge
          </span>
        </div>
        <div className="font-medium">
          NORSAN S.r.l. & ZREEN · Bolzano Logistics Hub
        </div>
      </footer>
    </div>
  );
};
