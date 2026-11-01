import React, { useState } from "react";
import {
  Lock,
  Barcode,
  ShieldCheck,
  Package,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  KeyRound,
  QrCode,
  Delete,
  CheckCircle2,
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
      if (numPart && (clean === numPart || clean === numPart.replace(/^0+/, ""))) {
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
        `Badge / PIN non riconosciuto: [${clean}]. Scansiona un badge autorizzato.`
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 md:p-6 select-none relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header Branding */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10 pt-2 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500 text-slate-950 rounded-2xl shadow-lg flex items-center justify-center font-black">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-widest text-white">
                NORSAN
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
                ZREEN NUTRACEUTICA
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              WMS Packaging Terminal • Hub di Spedizione Bolzano (BZ)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-mono text-emerald-400 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Sicurezza Operativa Attiva</span>
        </div>
      </header>

      {/* Main Authentication Box */}
      <main className="w-full max-w-lg z-10 my-auto flex flex-col items-center bg-slate-900/80 border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        {/* Optical Scanner Pulse Area */}
        <div className="relative mb-5 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-2xl flex items-center justify-center animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Barcode className="w-10 h-10 text-cyan-400" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 bg-slate-900 border-2 border-cyan-400 rounded-full text-cyan-400 shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <h1 className="text-xl md:text-2xl font-black tracking-tight text-center text-white">
          Postazione di Imballaggio Bloccata
        </h1>
        <p className="text-xs text-slate-400 text-center max-w-sm mt-1.5 font-medium leading-relaxed">
          Scansiona il tuo{" "}
          <strong className="text-cyan-400 font-mono font-black">
            Badge Barcode / QR Code (OP-01, OP-02, TL-01...)
          </strong>{" "}
          con la pistola ottica o digita il codice personale.
        </p>

        {/* Input Barcode / PIN Display */}
        <form onSubmit={handleFormSubmit} className="w-full mt-6">
          <div className="relative">
            <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
            <input
              type="text"
              placeholder="Scansiona badge o digita codice..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="w-full pl-11 pr-24 py-3.5 bg-slate-950 border-2 border-slate-700 hover:border-slate-500 focus:border-cyan-400 rounded-2xl text-base font-mono font-black text-cyan-300 placeholder:text-slate-600 focus:outline-none transition shadow-inner scanner-friendly tracking-wider text-center"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl transition active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
            >
              <span>Accedi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Success / Error Notification */}
        {successName && (
          <div className="mt-4 w-full px-4 py-2.5 bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs rounded-xl flex items-center justify-center gap-2 font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Accesso autorizzato: {successName}. Apertura postazione...</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 w-full px-4 py-2.5 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs rounded-xl flex items-center justify-center gap-2 font-bold animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Industrial Touchscreen Keypad (Clean 0-9 & OP Prefix) */}
        <div className="w-full mt-6 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 px-1">
            <span className="flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-cyan-400" /> Tastierino Touchscreen
            </span>
            <span>Digitazione diretta</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKeypadPress(key)}
                className="py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 rounded-xl font-mono text-lg font-black text-white transition active:scale-95 shadow-xs cursor-pointer"
              >
                {key}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="py-3 bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/60 rounded-xl font-mono text-xs font-black text-rose-400 transition active:scale-95 shadow-xs cursor-pointer uppercase"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 rounded-xl font-mono text-lg font-black text-white transition active:scale-95 shadow-xs cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/60 rounded-xl flex items-center justify-center font-mono text-amber-400 transition active:scale-95 shadow-xs cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Quick OP Prefix helper */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setInputCode("OP-")}
              className="py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl font-mono text-xs font-black text-cyan-300 transition active:scale-95 cursor-pointer"
            >
              Prefisso [ OP- ]
            </button>
            <button
              type="button"
              onClick={() => performLogin(inputCode)}
              className="py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl font-mono text-xs font-black transition active:scale-95 cursor-pointer shadow-md"
            >
              Conferma Invio ↵
            </button>
          </div>
        </div>

        {/* Security Notice: No 1-Click bypass */}
        <div className="mt-5 text-[11px] font-mono text-slate-500 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
          <span>Accesso vincolato a badge personale • Conforme Lean 5S</span>
        </div>
      </main>

      {/* Bottom Footer Info */}
      <footer className="w-full max-w-4xl z-10 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>
            Lettore Barcode USB / Bluetooth sempre attivo in modalità Keyboard Wedge
          </span>
        </div>
        <div>NORSAN S.r.l. & ZREEN • Bolzano Logistics Hub</div>
      </footer>
    </div>
  );
};
