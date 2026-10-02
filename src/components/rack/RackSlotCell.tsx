/**
 * rack/RackSlotCell.tsx
 * Renders a single warehouse slot cell in the rack map.
 * Handles: product info, P2L/TAVOLO badges, active order highlight, Lead edit button.
 */

import React from 'react';
import { Sparkles, CheckCircle2, Package, Pencil } from 'lucide-react';
import { Product } from '../../types/wms';
import { TierDef, SlotOverride } from './rackTypes';

export interface RackSlotCellProps {
  coord: string;
  tier: TierDef;
  product: Product | undefined;
  override: SlotOverride | undefined;
  isNeeded: boolean;
  isCompleted: boolean;
  isTeamLead: boolean;
  onSimulateScan: (ean: string) => void;
  onEdit: (product: Product) => void;
}

export const RackSlotCell: React.FC<RackSlotCellProps> = ({
  coord, tier, product, override, isNeeded, isCompleted, isTeamLead, onSimulateScan, onEdit,
}) => {
  const photoSrc = override?.customPhotoUrl || product?.imageUrl;

  let cellClass = 'border border-slate-200 bg-white text-slate-800';
  if (isNeeded)          cellClass = 'border-2 border-amber-400 bg-amber-50 ring-2 ring-amber-400/30 shadow-md';
  else if (isCompleted)  cellClass = 'border-2 border-emerald-500 bg-emerald-50 shadow-md';
  else if (tier.isFastBuffer) cellClass = 'border-2 border-violet-300 bg-violet-50/60';
  else if (!product)     cellClass = 'border border-dashed border-slate-200 bg-slate-50/50 text-slate-400';

  return (
    <div className={`relative rounded-xl p-2 flex flex-col gap-1 min-h-[100px] transition-all ${cellClass}`}>
      {/* Coordinate badge */}
      <div className="flex items-center justify-between gap-1">
        <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded border ${
          tier.isFastBuffer ? 'bg-violet-100 border-violet-300 text-violet-900'
          : tier.isNorsan   ? 'bg-cyan-100 border-cyan-300 text-cyan-900'
          : 'bg-slate-100 border-slate-300 text-slate-800'
        }`}>
          {coord}
        </span>
        <div className="flex items-center gap-0.5">
          {isNeeded && (
            <span className="text-[8px] bg-amber-500 text-white font-black px-1 py-0.5 rounded-full flex items-center gap-0.5">
              <Sparkles className="w-2 h-2" /> SERVE
            </span>
          )}
          {isCompleted && (
            <span className="text-[8px] bg-emerald-600 text-white font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
              <CheckCircle2 className="w-2 h-2" /> OK
            </span>
          )}
          {tier.isFastBuffer && (
            <span className="text-[8px] bg-violet-600 text-white font-bold px-1 py-0.5 rounded-full">TAVOLO</span>
          )}
        </div>
      </div>

      {/* Photo thumbnail */}
      {photoSrc && (
        <img src={photoSrc} alt={product?.name} className="w-full h-12 object-cover rounded-lg border border-slate-200" />
      )}

      {/* Product info or empty state */}
      {product ? (
        <div className="flex-1 flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-900 leading-tight line-clamp-2">{product.name}</div>
          {override?.notes && (
            <div className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 mt-0.5 leading-tight">
              ⚠ {override.notes}
            </div>
          )}
          <div className="flex items-center justify-between gap-1 mt-1">
            <span className="text-[9px] text-slate-500 font-mono truncate max-w-[50px]">{product.ean}</span>
            <div className="flex items-center gap-0.5">
              {isTeamLead && (
                <button onClick={() => onEdit(product)} className="p-0.5 rounded bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 transition" title="Modifica posizione / foto">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
              <button onClick={() => onSimulateScan(product.ean)} className="text-[9px] bg-slate-900 hover:bg-slate-700 text-white font-bold px-1.5 py-0.5 rounded transition">
                Scan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <Package className="w-4 h-4 text-slate-300" />
          <span className="text-[9px] text-slate-400 italic">Slot libero</span>
        </div>
      )}
    </div>
  );
};
