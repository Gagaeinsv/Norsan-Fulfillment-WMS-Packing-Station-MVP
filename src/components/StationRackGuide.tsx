import React from 'react';
import { X, MapPin, Sparkles, AlertCircle, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { NORSAN_PRODUCTS, MARKETING_FLYERS } from '../data/norsanProducts';
import { Order } from '../types/wms';

interface StationRackGuideProps {
  activeOrder: Order | null;
  onClose: () => void;
  onSimulateScan: (ean: string) => void;
}

export const StationRackGuide: React.FC<StationRackGuideProps> = ({
  activeOrder,
  onClose,
  onSimulateScan,
}) => {
  // Collect active required product IDs and their completion status in the active order
  const activeItemsMap = new Map<string, { required: number; scanned: number; completed: boolean }>();
  if (activeOrder) {
    activeOrder.items.forEach(item => {
      activeItemsMap.set(item.product.id, {
        required: item.quantityRequired,
        scanned: item.quantityScanned,
        completed: item.quantityScanned >= item.quantityRequired
      });
    });
  }

  // Filter products by rack and tier
  const getProductAtSlot = (locationCode: string) => {
    return NORSAN_PRODUCTS.find(p => p.shelfLocation === locationCode);
  };

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  // Italian standard: S = Sinistra (Left), D = Destra (Right)
  const leftSlots = [
    { tier: 3, name: 'Piano 3 (Alto - 1.7m) • 10 Posizioni', slots: letters.map(l => `S3-${l}`) },
    { tier: 2, name: 'Piano 2 (Medio - Golden Zone) • 10 Posizioni', slots: letters.map(l => `S2-${l}`) },
    { tier: 1, name: 'Piano 1 (Basso - Terra) • 10 Posizioni', slots: letters.map(l => `S1-${l}`) },
  ];

  const rightSlots = [
    { tier: 3, name: 'Piano 3 (Alto - 1.7m) • 10 Posizioni', slots: letters.map(l => `D3-${l}`) },
    { tier: 2, name: 'Piano 2 (Medio - Golden Zone) • 10 Posizioni', slots: letters.map(l => `D2-${l}`) },
    { tier: 1, name: 'Piano 1 (Basso - Terra) • 10 Posizioni', slots: letters.map(l => `D1-${l}`) },
  ];

  const renderSlotCell = (slotCode: string) => {
    const product = getProductAtSlot(slotCode);
    const activeInfo = product ? activeItemsMap.get(product.id) : null;
    const isNeeded = !!activeInfo;
    const isComplete = activeInfo?.completed;

    // Special slot for marketing flyers (D3-J)
    const isFlyerSlot = slotCode === 'D3-J' || slotCode === 'D3-C';

    let borderClass = 'border-slate-300 bg-white text-slate-800';
    if (isNeeded && !isComplete) {
      borderClass = 'border-2 border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-500/30';
    } else if (isNeeded && isComplete) {
      borderClass = 'border-2 border-emerald-500 bg-emerald-50 shadow-md';
    } else if (isFlyerSlot) {
      borderClass = 'border-2 border-cyan-400 bg-cyan-50/70';
    }

    return (
      <div
        key={slotCode}
        className={`p-2 rounded-xl border flex flex-col justify-between min-h-[95px] transition-all relative ${borderClass}`}
      >
        <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200">
          <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300">
            {slotCode}
          </span>
          {isNeeded && !isComplete && (
            <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> SERVE
            </span>
          )}
          {isNeeded && isComplete && (
            <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> OK
            </span>
          )}
          {isFlyerSlot && (
            <span className="text-[8px] bg-cyan-700 text-white font-bold px-1 py-0.5 rounded-full">
              FLYER
            </span>
          )}
        </div>

        {product ? (
          <div className="my-1">
            <div className="text-[11px] font-black text-slate-900 line-clamp-2 leading-tight">
              {product.name}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-600 truncate max-w-[45px]">
                {product.volume}
              </span>
              <button
                onClick={() => onSimulateScan(product.ean)}
                className="text-[9px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-1.5 py-0.5 rounded transition active:scale-95 shadow-xs"
              >
                Skan
              </button>
            </div>
          </div>
        ) : isFlyerSlot ? (
          <div className="my-1">
            <div className="text-[10px] font-black text-cyan-950">
              Opuscoli & Flyer
            </div>
            <div className="mt-1 text-right">
              <button
                onClick={() => onSimulateScan(MARKETING_FLYERS[0].code)}
                className="text-[9px] bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-1.5 py-0.5 rounded transition"
              >
                Skan
              </button>
            </div>
          </div>
        ) : (
          <div className="my-2 text-center text-slate-400 text-[10px] italic">
            Slot libero
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-2xl text-amber-800">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Mappa Posizioni Scaffalature • Hub Bolzano
                <span className="text-xs bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  10 Posizioni per Piano (A..J) • Standard S/D
                </span>
              </h2>
              <p className="text-xs text-slate-600">
                CapacitÃ  totale: 30 slot a Sinistra (S) + 30 slot a Destra (D) = 60 posizioni.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workstation layout body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-slate-100/50">
          {/* Workstation Center Indicator */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-3 text-center flex items-center justify-center gap-4 text-xs font-bold text-slate-800 shadow-xs">
            <span className="text-amber-700 font-mono">â† MANO SINISTRA: Scaffale S (10 per piano)</span>
            <span className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
              TAVOLO IMBALLAGGIO OPERATORE (PC + SCANNER)
            </span>
            <span className="text-cyan-700 font-mono">MANO DESTRA: Scaffale D (10 per piano) â†’</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Rack (Scaffale Sinistro - S) */}
            <div className="bg-white border-2 border-amber-300 rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
                  <h3 className="font-black text-amber-900 text-sm tracking-wide">
                    SCAFFALE S • SINISTRA (Oli Liquidi & Flaconi Vetro)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">3 Piani • 30 Posizioni (A..J)</span>
              </div>

              <div className="space-y-3">
                {leftSlots.map(tier => (
                  <div key={tier.tier} className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-black text-slate-700 mb-2 flex items-center justify-between">
                      <span>{tier.name}</span>
                      <span className="text-[10px] text-amber-800 font-mono font-bold bg-amber-100 px-2 py-0.5 rounded">S{tier.tier}-A .. S{tier.tier}-J</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {tier.slots.map(code => renderSlotCell(code))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Rack (Scaffale Destro - D) */}
            <div className="bg-white border-2 border-cyan-300 rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-cyan-500" />
                  <h3 className="font-black text-cyan-900 text-sm tracking-wide">
                    SCAFFALE D • DESTRA (Capsule, Gocce, Nutraceutici & Volantini)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">3 Piani • 30 Posizioni (A..J)</span>
              </div>

              <div className="space-y-3">
                {rightSlots.map(tier => (
                  <div key={tier.tier} className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-black text-slate-700 mb-2 flex items-center justify-between">
                      <span>{tier.name}</span>
                      <span className="text-[10px] text-cyan-800 font-mono font-bold bg-cyan-100 px-2 py-0.5 rounded">D{tier.tier}-A .. D{tier.tier}-J</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {tier.slots.map(code => renderSlotCell(code))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="bg-white p-4 rounded-2xl border border-slate-300 flex items-center gap-3 text-xs text-slate-700 shadow-xs">
            <AlertCircle className="w-5 h-5 text-norsan-600 flex-shrink-0" />
            <span>
              <strong>Regole speciali:</strong> Lo slot <strong className="text-cyan-800 font-mono">[D3-J]</strong> ospita gli opuscoli e volantini pubblicitari. Le posizioni sui 2 metri di scaffale sono numerate in ordine alfabetico da sinistra a destra (<strong className="font-mono">A .. J</strong>).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
