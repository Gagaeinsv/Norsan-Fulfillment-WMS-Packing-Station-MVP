import React from "react";
import { WarehouseStation } from "../../../types/wms";

export const TabLean: React.FC<{
  stations: WarehouseStation[];
}> = ({ stations }) => (
  <div className="space-y-4">
    {/* Top Lean Summary Banner */}
    <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-md border-2 border-emerald-700">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-700 text-emerald-100 font-mono px-3 py-1 rounded-full font-black uppercase tracking-wider">
              LEAN WAREHOUSING & 5S AUDIT
            </span>
            <span className="text-xs text-emerald-300 font-bold">
              • HUB BOLZANO
            </span>
          </div>
          <h2 className="text-2xl font-black mt-2">
            Eliminazione degli Sprechi (8 Muda) & Flusso Continuo
          </h2>
          <p className="text-xs text-emerald-200 mt-1 max-w-3xl">
            Ottimizzazione dei movimenti (Golden Zone), protezione preventiva
            dagli errori (Poka-Yoke 100%), eliminazione del cartaceo e
            bilanciamento del Takt Time tra le 3 postazioni attive.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-emerald-300 uppercase font-bold">
            Takt Time Obiettivo
          </div>
          <div className="text-3xl font-black font-mono text-emerald-300">
            40 sec
          </div>
          <div className="text-[11px] text-emerald-200 mt-0.5">
            Media reale: 38.5s (-4% vs Target)
          </div>
        </div>
      </div>
    </div>

    {/* 8 Wastes (Muda) Eliminator Scorecard */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <span className="text-xs font-black uppercase text-slate-800">
            1. Movimenti (Motion)
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
            -65% Spostamenti
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          I prodotti ad alta rotazione (Total Limone, Collagene) sono
          concentrati al <strong>Piano 2 (Golden Zone)</strong> tra bacino e
          torace, azzerando piegamenti e allungamenti.
        </p>
      </div>

      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <span className="text-xs font-black uppercase text-slate-800">
            2. Difetti (Defects)
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
            0.0% Errori Reclami
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          <strong>Poka-Yoke obbligatorio:</strong> la stampa dell'etichetta DHL
          è bloccata finché lo scanner non valida il 100% degli EAN corretti.
        </p>
      </div>

      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <span className="text-xs font-black uppercase text-slate-800">
            3. Attese (Waiting)
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
            0 ms Latenza
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Scanner HID Keyboard Wedge istantaneo. Passaggio automatico al collo
          successivo senza clic o ritardi nel caricamento.
        </p>
      </div>

      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <span className="text-xs font-black uppercase text-slate-800">
            4. Sovra-processo
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
            100% Paperless
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Flusso digitale diretto dall'e-commerce norsan.it. Zero bolle cartacee
          da stampare, archiviare o spuntare a penna.
        </p>
      </div>
    </div>

    {/* 5S Station Breakdown & Takt Time Pace Comparison */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {stations.map((st) => (
        <div
          key={st.id}
          className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-black text-slate-900">{st.name}</h4>
                <div className="text-xs text-slate-500 font-semibold">
                  {st.operatorName}
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded">
                {st.currentSpeedUPH} UPH
              </span>
            </div>

            <div className="space-y-2 mt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tempo Ciclo Medio:</span>
                <strong className="font-mono text-slate-900">
                  {st.id === "ST-02"
                    ? "38 sec"
                    : st.id === "ST-01"
                      ? "42 sec"
                      : "45 sec"}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Conformità Takt Time:</span>
                <strong className="text-emerald-700">96.4% in ritmo</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Audit 5S Postazione:</span>
                <strong className="text-cyan-800">5S Conforme âœ“</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Colli finiti oggi:
            </span>
            <span className="font-mono font-black text-slate-900">
              {st.ordersPackedToday}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
);
