import React from 'react';
import { Order } from '../../../types/wms';

export const TabEcommerce: React.FC<{
  orders: Order[];
}> = ({ orders }) => (
  <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 mb-3">Flusso Ordini in Tempo Reale</h3>
          <div className="space-y-2">
            {orders.map(o => (
              <div
                key={o.id}
                className="p-3 rounded-2xl border border-slate-200 hover:border-slate-400 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                    {o.orderNumber}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{o.customerName} ({o.customerCity})</div>
                    <div className="text-[10px] text-slate-500">{o.source} • {o.items.reduce((s: number, i: any) => s + i.quantityRequired, 0)} prodotti</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                    o.status === 'packed'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : o.status === 'packing'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}>
                    {o.status === 'packed' ? 'Spedito DHL' : o.status === 'packing' ? 'In Imballaggio' : 'In Coda'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {o.courier}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
);
