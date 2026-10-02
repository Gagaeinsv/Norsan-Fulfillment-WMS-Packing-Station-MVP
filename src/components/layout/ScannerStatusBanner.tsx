import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Barcode, MapPin } from 'lucide-react';
import { ScanEvent } from '../../types/wms';

interface ScannerStatusBannerProps {
  lastScan: ScanEvent | null;
}

export const ScannerStatusBanner: React.FC<ScannerStatusBannerProps> = ({ lastScan }) => {
  if (!lastScan) {
    return (
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex items-center justify-between gap-4 text-slate-300 shadow-lg select-none">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-800 rounded-2xl text-cyan-400 animate-pulse border border-slate-700">
            <Barcode className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">
              SCANNER PRONTO
            </div>
            <div className="text-xl font-black text-white tracking-wide">
              Scansiona il foglio d'ordine o il codice a barre del prodotto
            </div>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 font-mono text-sm">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-emerald-400 font-bold">Wedge Attivo</span>
        </div>
      </div>
    );
  }

  const isSuccess = lastScan.status === 'success';
  const isError = lastScan.status === 'error';
  const isWarning = lastScan.status === 'warning';

  let bgClass = 'bg-slate-900 border-slate-700 text-slate-100';
  let icon = <Barcode className="w-10 h-10 text-cyan-400" />;

  if (isSuccess) {
    bgClass = 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_35px_rgba(16,185,129,0.4)] animate-flash-green';
    icon = <CheckCircle className="w-10 h-10 text-white flex-shrink-0" />;
  } else if (isError) {
    bgClass = 'bg-rose-600 border-rose-400 text-white shadow-[0_0_40px_rgba(225,29,72,0.6)] animate-flash-red';
    icon = <XCircle className="w-10 h-10 text-white flex-shrink-0 animate-bounce" />;
  } else if (isWarning) {
    bgClass = 'bg-amber-600 border-amber-300 text-white shadow-[0_0_35px_rgba(245,158,11,0.4)]';
    icon = <AlertTriangle className="w-10 h-10 text-white flex-shrink-0" />;
  }

  return (
    <div className={`border-4 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-200 select-none ${bgClass}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-2 rounded-xl bg-black/20 flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase font-black tracking-widest text-white/90">
            {lastScan.title} • CODICE: <span className="font-mono bg-black/30 px-2 py-0.5 rounded text-white">{lastScan.rawCode}</span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-white tracking-wide truncate mt-0.5">
            {lastScan.message}
          </div>
        </div>
      </div>

      {lastScan.matchedProduct && (
        <div className="hidden md:flex items-center gap-3 bg-black/40 px-5 py-2.5 rounded-2xl border-2 border-white/20 flex-shrink-0 text-right">
          <div>
            <div className="text-xs text-white/80 font-bold uppercase tracking-wider">POSIZIONE</div>
            <div className="text-3xl font-black font-mono text-yellow-300 flex items-center gap-1 justify-end">
              <MapPin className="w-6 h-6 text-yellow-300" />
              [{lastScan.matchedProduct.shelfLocation}]
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
