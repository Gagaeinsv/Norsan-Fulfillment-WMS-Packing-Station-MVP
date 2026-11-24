/**
 * rack/RackSlotCell.tsx
 * Renders a single warehouse slot cell in the rack map.
 * Handles: product info, P2L/TAVOLO badges, active order highlight, Lead edit button.
 */

import React from "react";
import {
  Sparkles,
  CheckCircle2,
  Package,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { Product } from "../../types/wms";
import { TierDef, SlotOverride } from "./rackTypes";

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
  coord,
  tier,
  product,
  override,
  isNeeded,
  isCompleted,
  isTeamLead,
  onSimulateScan,
  onEdit,
}) => {
  const photoSrc = override?.customPhotoUrl || product?.imageUrl;

  let cellClass = "border border-slate-200/90 bg-white text-slate-800";
  if (isNeeded)
    cellClass =
      "border border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/25 shadow-xs";
  else if (isCompleted)
    cellClass = "border border-emerald-400 bg-emerald-50/50 shadow-2xs";
  else if (tier.isFastBuffer)
    cellClass = "border border-violet-300 bg-violet-50/40";
  else if (!product)
    cellClass =
      "border border-dashed border-slate-200 bg-slate-50/60 text-slate-400";

  return (
    <div
      className={`relative rounded-xl p-2 flex flex-col gap-1.5 min-h-[104px] transition-all ${cellClass}`}
    >
      {/* Coordinate badge */}
      <div className="flex items-center justify-between gap-1">
        <span
          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border tabular-nums ${
            tier.isFastBuffer
              ? "bg-violet-50 border-violet-200 text-violet-900"
              : tier.isNorsan
                ? "bg-norsan-50 border-norsan-200 text-norsan-900"
                : "bg-slate-100 border-slate-200 text-slate-800"
          }`}
        >
          {coord}
        </span>
        <div className="flex items-center gap-0.5">
          {isNeeded && (
            <span className="text-[8px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Sparkles className="w-2 h-2" /> SERVE
            </span>
          )}
          {isCompleted && (
            <span className="text-[8px] bg-emerald-600 text-white font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <CheckCircle2 className="w-2 h-2" /> OK
            </span>
          )}
          {tier.isFastBuffer && (
            <span className="text-[8px] bg-violet-600 text-white font-semibold px-1.5 py-0.5 rounded-full">
              TAVOLO
            </span>
          )}
        </div>
      </div>

      {/* Photo thumbnail */}
      {photoSrc && (
        <img
          src={photoSrc}
          alt={product?.name}
          className="w-full h-12 object-contain rounded-lg border border-slate-100 bg-slate-50 p-0.5"
        />
      )}

      {/* Product info or empty state */}
      {product ? (
        <div className="flex-1 flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-900 leading-tight line-clamp-2">
            {product.name}
          </div>
          {override?.notes && (
            <div className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 mt-0.5 leading-tight flex items-start gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{override.notes}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-1 mt-1">
            <span className="text-[9px] text-slate-400 font-mono truncate max-w-[54px]">
              {product.ean}
            </span>
            <div className="flex items-center gap-0.5">
              {isTeamLead && (
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 transition cursor-pointer"
                  title="Modifica posizione / foto"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onSimulateScan(product.ean)}
                className="text-[9px] bg-slate-900 hover:bg-slate-800 text-white font-semibold px-1.5 py-0.5 rounded-md transition cursor-pointer"
              >
                Scan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <Package className="w-4 h-4 text-slate-300" />
          <span className="text-[9px] text-slate-400">Slot libero</span>
        </div>
      )}
    </div>
  );
};
