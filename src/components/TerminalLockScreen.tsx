import React, { useState } from 'react';
import {
  Lock,
  Barcode,
  Users,
  ShieldCheck,
  Package,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  KeyRound
} from 'lucide-react';
import { Operator } from '../types/wms';

interface TerminalLockScreenProps {
  operators: Operator[];
  onLogin: (operator: Operator) => void;
}

export const TerminalLockScreen: React.FC<TerminalLockScreenProps> = ({
  operators,
  onLogin,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = manualCode.trim().toUpperCase();
    if (!cleanCode) return;

    const matched = operators.find(
      op => op.operatorCode.toUpperCase() === cleanCode || op.name.toUpperCase() === cleanCode
    );

    if (matched) {
      setErrorMsg(null);
      onLogin(matched);
    } else {
      setErrorMsg(`Nessun operatore registrato con il badge "${cleanCode}"`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-6 select-none relative overflow-hidden">
      {/* Background glowing ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header Branding */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10 pt-2 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500 text-slate-950 rounded-2xl shadow-lg flex items-center justify-center font-black">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-widest text-white">NORSAN</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">ZREEN NUTRACEUTICA</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              WMS Packaging Terminal • Hub di Spedizione Bolzano (BZ)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-mono text-emerald-400 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Sistema Operativo Online (v2.6)</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-4xl z-10 my-8 flex flex-col items-center">
        {/* Central Scan Icon & Pulse */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-2xl flex items-center justify-center animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Barcode className="w-12 h-12 text-cyan-400" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-slate-900 border-2 border-cyan-400 rounded-full text-cyan-400 shadow-md">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-center text-white">
          Postazione di Imballaggio Bloccata
        </h1>
        <p className="text-sm text-slate-400 text-center max-w-lg mt-2 font-medium">
          Scansiona il tuo <strong className="text-cyan-400 font-mono">Badge Barcode (OP-XXX)</strong> con il lettore ottico oppure seleziona il tuo profilo operatore in basso.
        </p>

        {/* Manual Barcode Input Form */}
        <form onSubmit={handleManualSubmit} className="w-full max-w-md mt-6 flex items-center gap-2">
          <div className="relative flex-1">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Inserisci codice badge (es. OP-042)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border-2 border-slate-700 hover:border-slate-500 focus:border-cyan-400 rounded-2xl text-sm font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none transition shadow-inner scanner-friendly"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-2xl transition active:scale-95 shadow-lg flex items-center gap-1.5 cursor-pointer flex-shrink-0"
          >
            <span>Accedi</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 px-4 py-2 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs rounded-xl flex items-center gap-2 font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Operator Profile Selector */}
        <div className="w-full mt-10">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Operatori Autorizzati su questo Terminale ({operators.length})</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">Accesso 1-Click</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {operators.map(op => {
              const isLead = op.role === 'team_lead' || op.role === 'supervisor';

              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => onLogin(op)}
                  className="p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border-2 border-slate-800 hover:border-cyan-400/80 rounded-2xl transition-all duration-150 active:scale-95 text-left flex items-center gap-3 shadow-md group cursor-pointer"
                >
                  <img
                    src={op.avatarUrl}
                    alt={op.name}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700 group-hover:border-cyan-400 flex-shrink-0 transition"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-white group-hover:text-cyan-300 truncate transition">
                      {op.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10px] font-black bg-slate-800 group-hover:bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-300 border border-slate-700">
                        {op.operatorCode}
                      </span>
                      {isLead && (
                        <span className="text-[9px] font-black uppercase bg-purple-900/80 text-purple-200 px-1.5 py-0.5 rounded border border-purple-600">
                          Lead
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {op.stationId} • {op.packedToday} colli
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="w-full max-w-5xl z-10 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Lettore Barcode USB / Bluetooth sempre attivo in modalitÃ  Keyboard Wedge</span>
        </div>
        <div>
          Conforme standard Lean 5S & Poka-Yoke • NORSAN Italia
        </div>
      </div>
    </div>
  );
};
