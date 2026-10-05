import React from "react";
import { ArrowRight } from "lucide-react";
import { WarehouseStation } from "../../../types/wms";

export const TabStations: React.FC<{
  stations: WarehouseStation[];
  onSwitchToStation: (stationId: string) => void;
}> = ({ stations, onSwitchToStation }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {stations.map((st) => (
      <div
        key={st.id}
        className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-300">
                {st.id}
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900">{st.name}</h3>
                <div className="text-xs text-slate-500 font-semibold">
                  {st.operatorName} ({st.operatorCode})
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg border ${
                st.status === "packing"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : st.status === "idle"
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
              }`}
            >
              {st.status === "packing"
                ? "In Imballaggio"
                : st.status === "idle"
                  ? "In Attesa"
                  : "In Pausa"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Colli Oggi
              </div>
              <div className="text-lg font-black font-mono text-slate-900 mt-0.5">
                {st.ordersPackedToday}
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                UPH
              </div>
              <div className="text-lg font-black font-mono text-amber-700 mt-0.5">
                {st.currentSpeedUPH}
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Precisione
              </div>
              <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                {st.accuracy}%
              </div>
            </div>
          </div>

          {st.currentOrderNumber && (
            <div className="mt-3.5 p-2.5 bg-cyan-50 border border-cyan-200 rounded-xl text-xs flex items-center justify-between">
              <span className="text-slate-600">Ordine in corso:</span>
              <strong className="font-mono text-norsan-900">
                {st.currentOrderNumber}
              </strong>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={() => onSwitchToStation(st.id)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <span>Apri Vista Banco</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    ))}
  </div>
);
