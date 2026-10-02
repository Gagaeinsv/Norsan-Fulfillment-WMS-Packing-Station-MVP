import React from 'react';
import { Check, Sparkles, ShieldAlert, Barcode, MapPin } from 'lucide-react';
import { OrderItem } from '../../types/wms';

interface PackingItemListProps {
  items: OrderItem[];
  onSimulateItemScan: (ean: string) => void;
}

export const PackingItemList: React.FC<PackingItemListProps> = ({
  items,
  onSimulateItemScan,
}) => {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isCompleted = item.quantityScanned >= item.quantityRequired;
        const isPartial = item.quantityScanned > 0 && !isCompleted;
        const progressPercent = Math.min(100, Math.round((item.quantityScanned / item.quantityRequired) * 100));

        let cardBorder = 'border-slate-800 bg-slate-900/80 hover:border-slate-700';
        if (isCompleted) {
          cardBorder = 'border-emerald-500/80 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.12)]';
        } else if (isPartial) {
          cardBorder = 'border-amber-500/80 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
        }

        return (
          <div
            key={item.product.id}
            className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${cardBorder}`}
          >
            {/* Left: Product Info & Shelf Locator */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Product Thumbnail with Fragile Badge */}
              <div className="relative flex-shrink-0">
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700 bg-slate-950 shadow-inner"
                />
                {item.product.fragile && (
                  <div
                    className="absolute -top-1.5 -right-1.5 p-1 bg-amber-500 text-slate-950 rounded-full shadow"
                    title="Bottiglia in Vetro - Proteggere con pluriball"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Names & Codes */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {/* High Visibility Shelf Address Badge */}
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 shadow-sm border border-amber-300">
                    <MapPin className="w-3.5 h-3.5" />
                    POSIZIONE: [{item.product.shelfLocation}]
                  </span>

                  <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    SKU: {item.product.sku}
                  </span>

                  {item.product.fragile && (
                    <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80">
                      Vetro • Pluriball
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white truncate">
                  {item.product.name}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {item.product.italianName} ({item.product.volume})
                </p>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
                  <Barcode className="w-3.5 h-3.5 text-slate-400" />
                  <span>EAN: <strong className="text-slate-200">{item.product.ean}</strong></span>
                </div>
              </div>
            </div>

            {/* Right: Quantity Progress, Counter & Actions */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
              {/* Progress Bar & Numerical count */}
              <div className="text-right flex-shrink-0 min-w-[140px]">
                <div className="flex items-center justify-end gap-2 mb-1.5">
                  <span className="text-xs uppercase font-semibold text-slate-400">Scansionati:</span>
                  <span className={`text-2xl font-black font-mono ${
                    isCompleted ? 'text-emerald-400' : isPartial ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    {item.quantityScanned} <span className="text-base text-slate-500 font-normal">/ {item.quantityRequired}</span>
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                        : isPartial
                        ? 'bg-amber-400'
                        : 'bg-slate-700'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Status Badge / Quick Scan action */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isCompleted ? (
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-3 py-2 rounded-xl font-bold text-xs">
                    <Check className="w-4 h-4" />
                    <span>OK</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onSimulateItemScan(item.product.ean)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition"
                    title="Simula lettura codice a barre con lo scanner"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Skan +1</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
