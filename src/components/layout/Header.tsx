import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Package,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  LayoutGrid,
  HelpCircle,
  RefreshCw,
  User,
  Barcode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  Lock,
} from "lucide-react";
import { StationKPIs, Operator, ScanEvent } from "../../types/wms";

interface HeaderProps {
  currentOperator: Operator;
  kpis: StationKPIs;
  lastScan: ScanEvent | null;
  isMuted: boolean;
  activeView: "packing" | "supervisor";
  onToggleView: () => void;
  onToggleMute: () => void;
  onOpenRackGuide: () => void;
  onOpenSimulator: () => void;
  onOpenOperatorAuth: () => void;
  onLockTerminal: () => void;
  onResetData: () => void;
  stationConfigId: string;
  onChangeStationConfig: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentOperator,
  kpis,
  lastScan,
  isMuted,
  activeView,
  onToggleView,
  onToggleMute,
  onOpenRackGuide,
  onOpenSimulator,
  onOpenOperatorAuth,
  onLockTerminal,
  onResetData,
  stationConfigId,
  onChangeStationConfig,
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Status computation for the scanner widget
  const isSuccess = lastScan?.status === "success";
  const isError = lastScan?.status === "error";
  const isWarning = lastScan?.status === "warning";

  let scannerBoxClass = "bg-slate-100 border-slate-300 text-slate-700";
  let scannerIcon = <Barcode className="w-5 h-5 text-norsan-600" />;
  let scannerBadge = (
    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
      Wedge Attivo
    </span>
  );

  if (lastScan) {
    if (isSuccess) {
      scannerBoxClass =
        "bg-emerald-600 border-emerald-500 text-white shadow-md animate-flash-green";
      scannerIcon = <CheckCircle className="w-5 h-5 text-white" />;
      scannerBadge = (
        <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded">
          OK (+1)
        </span>
      );
    } else if (isError) {
      scannerBoxClass =
        "bg-rose-600 border-rose-500 text-white shadow-md animate-flash-red";
      scannerIcon = <XCircle className="w-5 h-5 text-white animate-bounce" />;
      scannerBadge = (
        <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded">
          ERRORE
        </span>
      );
    } else if (isWarning) {
      scannerBoxClass =
        "bg-amber-500 border-amber-600 text-slate-950 shadow-md";
      scannerIcon = <AlertTriangle className="w-5 h-5 text-slate-950" />;
      scannerBadge = (
        <span className="text-[10px] font-black bg-white/30 text-slate-950 px-2 py-0.5 rounded">
          AVVISO
        </span>
      );
    }
  }

  const isLead =
    currentOperator.role === "team_lead" ||
    currentOperator.role === "supervisor";

  return (
    <header className="bg-white border-b border-slate-300 px-3 py-1.5 flex items-center justify-between gap-3 select-none shadow-sm min-h-[48px]">
      {/* 1. Left: Brand & Operator Profile */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="bg-norsan-600 text-white p-2 rounded-xl flex items-center justify-center shadow-xs">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black tracking-wider text-base text-slate-900 font-sans">
              NORSAN
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 font-mono font-black">
              {currentOperator.stationId} • BOLZANO
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-0.5 font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Zero-Error
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
            <button
              onClick={onOpenOperatorAuth}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 text-slate-800 transition active:scale-95 text-[11px] font-bold cursor-pointer"
              title="Cambia operatore o scansiona badge"
            >
              <User className="w-3 h-3 text-norsan-600" />
              <span>{currentOperator.name}</span>
              <span className="font-mono text-[9px] text-norsan-800 font-black">
                [{currentOperator.operatorCode}]
              </span>
              <span
                className={`text-[9px] px-1 py-0.5 rounded font-black uppercase ${
                  isLead
                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {isLead ? "Lead" : "Packer"}
              </span>
            </button>

            {/* Lock / Logout button */}
            <button
              onClick={onLockTerminal}
              className="p-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-300 hover:border-rose-300 transition active:scale-95 cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
              title="Blocca postazione / Esci dalla sessione"
            >
              <Lock className="w-3 h-3" />
              <span>Blocca</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Center: Compact High-Visibility Live Scanner Status Banner */}
      <div
        className={`flex-1 max-w-2xl px-3.5 py-1.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 shadow-xs ${scannerBoxClass}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-black/10 flex-shrink-0">
            {scannerIcon}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider opacity-90 truncate">
              {lastScan
                ? lastScan.title
                : "SCANNER PRONTO • INSERIMENTO CODICE"}
            </div>
            <div className="text-xs font-black truncate leading-tight">
              {lastScan
                ? lastScan.message
                : "Scansiona foglio d'ordine, prodotto, scatola o badge"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {lastScan?.matchedProduct && (
            <div className="hidden sm:flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-lg font-mono text-xs font-black">
              <MapPin className="w-3.5 h-3.5" />
              <span>[{lastScan.matchedProduct.shelfLocation}]</span>
            </div>
          )}
          {scannerBadge}
        </div>
      </div>

      {/* 3. Right: Compact KPI Badges & Quick Action Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Completed count */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-slate-500">Colli:</span>
          <span className="font-mono font-black text-slate-900">
            {kpis.totalPackedToday}
          </span>
        </div>

        {/* Timer */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <Clock className="w-4 h-4 text-cyan-600" />
          <span className="font-mono font-black text-slate-800">
            {formatTimer(seconds)}
          </span>
        </div>

        {/* Supervisor View Switcher */}
        <button
          onClick={onToggleView}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 border cursor-pointer ${
            activeView === "supervisor"
              ? "bg-purple-700 border-purple-800 text-white"
              : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          }`}
          title={
            isLead
              ? "Passa a Dashboard Direzione"
              : "Accesso Riservato Team Lead (Richiede PIN)"
          }
        >
          <span>
            {activeView === "supervisor" ? "← Postazione"
              : isLead
                ? "👔 Dashboard Lead"
                : "🔒 Lead (PIN)"}
          </span>
        </button>

        {/* Station Config Switcher */}
        <div className="hidden xl:flex items-center">
          <select
            value={stationConfigId}
            onChange={(e) => onChangeStationConfig(e.target.value)}
            className="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-norsan-500 cursor-pointer"
          >
            <option value="STATION_01">
              ⚙️ Postazione #01 (Norsan ⬅️ / Zreen ➡️)
            </option>
            <option value="STATION_02">
              ⚙️ Postazione #02 (Norsan ➡️ / Zreen ⬅️)
            </option>
          </select>
        </div>

        {/* Rack Map */}
        {activeView === "packing" && (
          <button
            onClick={onOpenRackGuide}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 transition active:scale-95 shadow-xs cursor-pointer"
            title="Mappa Scaffali Sinistro/Destro"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-700" />
            <span>Mappa (S/D)</span>
          </button>
        )}

        {/* Simulator Drawer Button */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-norsan-600 hover:bg-norsan-700 text-white text-xs font-bold border border-norsan-700 transition active:scale-95 shadow-xs cursor-pointer"
          title="Simulatore Pistola Scanner"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Scanner</span>
        </button>

        {/* Audio Mute */}
        <button
          onClick={onToggleMute}
          className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
            isMuted
              ? "bg-rose-50 border-rose-300 text-rose-700"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
          }`}
          title={isMuted ? "Audio disattivato" : "Audio attivo"}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        {/* Reset Demo */}
        <button
          onClick={onResetData}
          className="p-2 rounded-xl bg-white border border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
          title="Ripristina Dati Demo"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
