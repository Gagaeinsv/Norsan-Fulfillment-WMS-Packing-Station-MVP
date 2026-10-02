import React from 'react';
import { CheckCircle, AlertOctagon } from 'lucide-react';
import { IssueTicket } from '../../../types/wms';

export const TabIssues: React.FC<{
  issues: IssueTicket[];
  onResolveIssue: (issueId: string) => void;
}> = ({ issues, onResolveIssue }) => (
  <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 mb-3">Richieste di Assistenza & Rifornimento Kanban</h3>
          {issues.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic">
              Nessuna anomalia o richiesta aperta al momento.
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map(iss => (
                <div
                  key={iss.id}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                    iss.status === 'pending'
                      ? 'bg-rose-50/60 border-rose-300'
                      : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      iss.status === 'pending' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <AlertOctagon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">{iss.type}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{iss.note}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Postazione: {iss.stationId} • Operatore: {iss.operatorName} • Ordine: {iss.orderNumber}
                      </div>
                    </div>
                  </div>

                  <div>
                    {iss.status === 'pending' ? (
                      <button
                        onClick={() => onResolveIssue(iss.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition active:scale-95 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Risolvi & Rifornisci</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-800 font-bold bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                        Risolto
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
);
