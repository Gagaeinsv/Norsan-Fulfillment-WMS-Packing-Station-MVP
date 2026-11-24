import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  LayoutGrid,
  ScanBarcode,
  RefreshCw,
  User,
  Barcode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  Lock,
  FileSpreadsheet,
  Link2,
  ArrowRight,
  ArrowLeft,
  Shield,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { StationKPIs, Operator, ScanEvent, Product } from "../../types/wms";

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
  onOpenSellyModal?: () => void;
  onQuickSwitchOrder?: (orderId: string, autoScanBarcode?: string) => void;
  onForceAddProduct?: (product: Product) => void;
  onOpenBindModal?: (barcode: string) => void;
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
  onOpenSellyModal,
  onQuickSwitchOrder,
  onForceAddProduct,
  onOpenBindModal,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Status computation for the scanner widget
  const isSuccess = lastScan?.status === "success";
  const isError = lastScan?.status === "error";
  const isWarning = lastScan?.status === "warning";

  let scannerBoxClass =
    "bg-slate-50 border-slate-200/90 text-slate-700";
  let scannerIconWrapClass = "bg-white border border-slate-200 text-norsan-700";
  let scannerIcon = <Barcode className="w-4 h-4" />;
  let scannerBadge = (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span>Pronto</span>
    </span>
  );

  if (lastScan) {
    if (isSuccess) {
      scannerBoxClass =
        "bg-emerald-600 border-emerald-600 text-white shadow-sm animate-flash-green";
      scannerIconWrapClass = "bg-white/15 border border-white/20 text-white";
      scannerIcon = <CheckCircle className="w-4 h-4" />;
      scannerBadge = (
        <span className="text-[11px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-md">
          OK (+1)
        </span>
      );
    } else if (isError) {
      scannerBoxClass =
        "bg-rose-600 border-rose-600 text-white shadow-sm animate-flash-red";
      scannerIconWrapClass = "bg-white/15 border border-white/20 text-white";
      scannerIcon = <XCircle className="w-4 h-4" />;
      scannerBadge = (
        <span className="text-[11px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-md">
          ERRORE
        </span>
      );
    } else if (isWarning) {
      scannerBoxClass =
        "bg-amber-400 border-amber-500 text-slate-950 shadow-sm";
      scannerIconWrapClass = "bg-slate-950/10 border border-slate-950/10 text-slate-950";
      scannerIcon = <AlertTriangle className="w-4 h-4" />;
      scannerBadge = (
        <span className="text-[11px] font-mono font-bold bg-slate-950/15 text-slate-950 px-2 py-0.5 rounded-md">
          AVVISO
        </span>
      );
    }
  }

  const isLead =
    currentOperator.role === "team_lead" ||
    currentOperator.role === "supervisor";

  return (
    <header className="bg-white border-b border-slate-200/90 px-4 py-2 flex items-center justify-between gap-4 select-none min-h-[60px] shrink-0">
      {/* 1. Left: Brand & Operator Profile */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-norsan-700 text-white rounded-xl flex items-center justify-center shadow-2xs">
          <Package className="w-4.5 h-4.5" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-sm text-slate-900">
              NORSAN
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono font-semibold">
              {currentOperator.stationId} · BZ
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              type="button"
              onClick={onOpenOperatorAuth}
              className="flex items-center gap-1.5 text-slate-700 hover:text-slate-950 transition text-xs font-medium cursor-pointer group"
              title="Cambia operatore o scansiona badge"
            >
              <User className="w-3 h-3 text-slate-400 group-hover:text-norsan-600 transition" />
              <span className="font-semibold">{currentOperator.name}</span>
              <span className="font-mono text-[10px] text-slate-500">
                {currentOperator.operatorCode}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0 rounded font-semibold ${
                  isLead
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {isLead ? "Lead" : "Packer"}
              </span>
            </button>

            <span className="text-slate-300">·</span>

            <button
              type="button"
              onClick={onLockTerminal}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Blocca postazione / Esci dalla sessione"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Center: Sleek Live Scanner Status Bar */}
      <div
        className={`flex-1 max-w-2xl px-3.5 py-2 rounded-xl border transition-colors flex items-center justify-between gap-3 min-w-0 ${scannerBoxClass}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${scannerIconWrapClass}`}
          >
            {scannerIcon}
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                lastScan ? "opacity-90" : "text-slate-500"
              }`}
            >
              {lastScan ? lastScan.title : "Scanner Pronto · Keyboard Wedge"}
            </div>
            <div className="text-xs font-semibold truncate leading-snug">
              {lastScan
                ? lastScan.message
                : "Scansiona foglio d'ordine, prodotto, scatola o badge"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick action: Candidate order switch */}
          {lastScan?.otherOrderCandidate && onQuickSwitchOrder && (
            <button
              type="button"
              onClick={() =>
                onQuickSwitchOrder(
                  lastScan.otherOrderCandidate!.orderId,
                  lastScan.rawCode,
                )
              }
              className="bg-amber-300 hover:bg-amber-200 text-slate-950 px-2.5 py-1 rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
              title={`Apri l'ordine ${lastScan.otherOrderCandidate.orderNumber} e registra la scansione`}
            >
              <span>Vai a {lastScan.otherOrderCandidate.orderNumber}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick action: Force add to current order (Test Mode) */}
          {!lastScan?.otherOrderCandidate &&
            lastScan?.status === "error" &&
            lastScan?.matchedProduct &&
            onForceAddProduct && (
              <button
                type="button"
                onClick={() => onForceAddProduct(lastScan.matchedProduct!)}
                className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 border border-white/30 cursor-pointer flex items-center gap-1"
                title="Aggiungi comunque a questo ordine (Modalità Test MVP)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Aggiungi (Test)</span>
              </button>
            )}

          {/* Quick action: Bind unknown barcode */}
          {lastScan?.resultType === "unknown_code" && onOpenBindModal && (
            <button
              type="button"
              onClick={() => onOpenBindModal(lastScan.rawCode)}
              className="bg-amber-300 hover:bg-amber-200 text-slate-950 px-2.5 py-1 rounded-lg font-bold text-xs transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-xs"
              title="Associa questo barcode a un prodotto del catalogo"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Associa</span>
            </button>
          )}

          {lastScan?.matchedProduct && (
            <div className="hidden sm:flex items-center gap-1 bg-black/15 px-2 py-0.5 rounded-md font-mono text-xs font-semibold">
              <MapPin className="w-3 h-3" />
              <span>{lastScan.matchedProduct.shelfLocation}</span>
            </div>
          )}

          {scannerBadge}
        </div>
      </div>

      {/* 3. Right: Unified KPI Pill, Primary Actions & Utilities Popover */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Unified KPI pill */}
        <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/90 text-xs tabular-nums">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-500 font-medium">Colli</span>
            <span className="font-mono font-bold text-slate-900">
              {kpis.totalPackedToday}
            </span>
          </div>
          <div className="w-px h-3.5 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-norsan-600" />
            <span className="font-mono font-bold text-slate-800">
              {formatTimer(seconds)}
            </span>
          </div>
        </div>

        {/* Rack Map */}
        {activeView === "packing" && (
          <button
            type="button"
            onClick={onOpenRackGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200/90 transition active:scale-95 cursor-pointer"
            title="Mappa Scaffali Sinistro/Destro"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
            <span>Mappa</span>
          </button>
        )}

        {/* Selly ERP CSV Import */}
        {onOpenSellyModal && (
          <button
            type="button"
            onClick={onOpenSellyModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-norsan-700 hover:bg-norsan-800 text-white text-xs font-semibold transition active:scale-95 shadow-2xs cursor-pointer"
            title="Importa Ordini da Selly ERP (CSV 1-Click)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Selly CSV</span>
          </button>
        )}

        {/* Supervisor View Switcher */}
        <button
          type="button"
          onClick={onToggleView}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 border cursor-pointer ${
            activeView === "supervisor"
              ? "bg-slate-900 border-slate-900 text-white"
              : "bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50"
          }`}
          title={
            isLead
              ? "Passa a Dashboard Direzione"
              : "Accesso Riservato Team Lead (Richiede PIN)"
          }
        >
          {activeView === "supervisor" ? (
            <>
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Postazione</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>{isLead ? "Lead" : "Lead (PIN)"}</span>
            </>
          )}
        </button>

        {/* Audio Mute */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
            isMuted
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50"
          }`}
          title={isMuted ? "Audio disattivato" : "Audio attivo"}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        {/* Secondary Utilities Popover */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
              isMenuOpen
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50"
            }`}
            title="Strumenti postazione, simulatore scanner e reset"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-50 flex flex-col gap-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                Configurazione Postazione
              </div>
              <select
                value={stationConfigId}
                onChange={(e) => onChangeStationConfig(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-norsan-500 cursor-pointer"
              >
                <option value="STATION_01">
                  Postazione #01 (Norsan SX / Zreen DX)
                </option>
                <option value="STATION_02">
                  Postazione #02 (Norsan DX / Zreen SX)
                </option>
              </select>

              <div className="h-px bg-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSimulator();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left"
              >
                <ScanBarcode className="w-4 h-4 text-norsan-700" />
                <span>Simulatore Pistola Scanner</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onResetData();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition cursor-pointer text-left"
              >
                <RefreshCw className="w-4 h-4 text-rose-600" />
                <span>Ripristina Dati Demo</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
