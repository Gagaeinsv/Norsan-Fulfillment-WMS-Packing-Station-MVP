import React, { useState } from "react";
import {
  MapPin,
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  Save,
  CheckCircle2,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Product } from "../../types/wms";

export interface WarehouseSlotData {
  slot_code: string;
  side: "S" | "D";
  tier: 1 | 2 | 3;
  description: string;
  product_id?: string | null;
  product_name?: string | null;
  product_italian_name?: string | null;
  product_ean?: string | null;
  product_brand?: string | null;
  product_volume?: string | null;
  product_image_url?: string | null;
}

interface SlottingManagerProps {
  slots: WarehouseSlotData[];
  products: Product[];
  onAssignSlot: (slotCode: string, productId: string | null) => Promise<void>;
  onAddSlot: (side: "S" | "D", tier: 1 | 2 | 3) => Promise<void>;
  onDeleteSlot: (slotCode: string) => Promise<void>;
}

export const SlottingManager: React.FC<SlottingManagerProps> = ({
  slots,
  products,
  onAssignSlot,
  onAddSlot,
  onDeleteSlot,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<WarehouseSlotData | null>(
    null,
  );
  const [chosenProductId, setChosenProductId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleOpenAssignModal = (slot: WarehouseSlotData) => {
    setSelectedSlot(slot);
    setChosenProductId(slot.product_id || "");
    setSaveSuccess(false);
  };

  const handleSaveAssignment = async () => {
    if (!selectedSlot) return;
    setIsSaving(true);
    try {
      await onAssignSlot(selectedSlot.slot_code, chosenProductId || null);
      setSaveSuccess(true);
      setTimeout(() => {
        setSelectedSlot(null);
        setSaveSuccess(false);
      }, 700);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurrentSlot = async (slotCode: string) => {
    if (
      confirm(`Sei sicuro di voler eliminare lo slot fisico [${slotCode}]?`)
    ) {
      setIsSaving(true);
      try {
        await onDeleteSlot(slotCode);
        if (selectedSlot?.slot_code === slotCode) {
          setSelectedSlot(null);
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Group slots by Left / Right and Tiers
  const leftSlots = slots.filter((s) => s.side === "S");
  const rightSlots = slots.filter((s) => s.side === "D");

  const renderSlotCard = (slot: WarehouseSlotData) => {
    const isOccupied = !!slot.product_id;
    const isZreen = slot.product_brand === "ZREEN";
    const isFlyerSlot = slot.slot_code === "D3-J" || slot.slot_code === "D3-C";

    return (
      <div
        key={slot.slot_code}
        onClick={() => !isFlyerSlot && handleOpenAssignModal(slot)}
        className={`p-2 rounded-xl border-2 transition-all flex flex-col justify-between min-h-[110px] shadow-xs relative group ${
          isFlyerSlot
            ? "bg-cyan-50/80 border-cyan-300 cursor-default"
            : isOccupied
              ? "bg-white border-slate-300 hover:border-norsan-600 hover:shadow-md cursor-pointer"
              : "bg-slate-50/60 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer hover:bg-slate-100"
        }`}
      >
        {/* Top: Slot code, Badge & Quick Delete */}
        <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200">
          <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300">
            [{slot.slot_code}]
          </span>

          <div className="flex items-center gap-1">
            {isFlyerSlot ? (
              <span className="text-[8px] font-black bg-cyan-700 text-white px-1.5 py-0.5 rounded-full">
                VOLANTINI
              </span>
            ) : isOccupied ? (
              <span
                className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                  isZreen
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    : "bg-cyan-100 text-cyan-900 border border-cyan-300"
                }`}
              >
                {slot.product_brand}
              </span>
            ) : (
              <span className="text-[8px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                LIBERO
              </span>
            )}

            {!isFlyerSlot && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCurrentSlot(slot.slot_code);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                title="Elimina questo slot"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Center: Product info */}
        {isFlyerSlot ? (
          <div className="my-1 text-[10px]">
            <div className="font-black text-cyan-950 truncate">
              Opuscoli NORSAN/ZREEN
            </div>
            <div className="text-[9px] text-cyan-700">Slot Volantini</div>
          </div>
        ) : isOccupied ? (
          <div className="my-1 flex items-center gap-2">
            <img
              src={slot.product_image_url || ""}
              alt=""
              className="w-8 h-8 rounded-lg object-cover border border-slate-300 bg-white flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-slate-900 line-clamp-2 leading-tight">
                {slot.product_name}
              </div>
            </div>
          </div>
        ) : (
          <div className="my-2 text-center text-slate-400 text-[10px] italic">
            + Assegna
          </div>
        )}

        {/* Bottom footer button */}
        {!isFlyerSlot && (
          <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
            <span className="truncate max-w-[50px]">
              {isOccupied ? slot.product_volume : "Slot vuoto"}
            </span>
            <span className="font-bold text-norsan-700 flex items-center gap-0.5">
              Modifica <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderTierSection = (
    title: string,
    tierSlots: WarehouseSlotData[],
    side: "S" | "D",
    tier: 1 | 2 | 3,
    badgeColor: string,
  ) => {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-black text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>
              {title} ({tierSlots.length} slot attivi)
            </span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeColor}`}
            >
              {side}
              {tier}
            </span>
          </div>

          {/* Add Slot Header Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddSlot(side, tier);
            }}
            className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-black px-3 py-1 rounded-xl transition active:scale-95 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>+ Aggiungi Slot</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {tierSlots.map((s) => renderSlotCard(s))}

          {/* Inline Quick Add Card */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddSlot(side, tier);
            }}
            className="p-2 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 bg-white/60 hover:bg-slate-100 flex flex-col items-center justify-center min-h-[110px] transition active:scale-95 text-slate-500 hover:text-slate-900 shadow-xs cursor-pointer group"
          >
            <div className="p-2 rounded-full bg-slate-100 group-hover:bg-slate-200 text-slate-700 mb-1 transition">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider">
              + Nuovo Slot
            </span>
            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
              (Piano {side}
              {tier})
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 space-y-5 shadow-sm select-none">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                Gestione Mappa Scaffali Dinamica (Aggiungi / Rimuovi Slot
                Flessibili)
              </h2>
              <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2.5 py-0.5 rounded-full font-mono">
                {slots.length} SLOT ATTIVI
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Puoi aggiungere nuovi slot o rimuoverli se un prodotto occupa più
              spazio (ad es. 8 o 9 slot più larghi per piano invece di 10).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-700">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>
            FlessibilitÃ  totale: assegna, elimina o crea nuove posizioni in
            tempo reale
          </span>
        </div>
      </div>

      {/* Racks Grid (Left vs Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Rack (S - Sinistra) */}
        <div className="bg-slate-50 border-2 border-amber-300 rounded-3xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
              <h3 className="font-black text-amber-950 text-sm tracking-wide">
                SCAFFALE S • SINISTRA (Oli Liquidi & Barattoli)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">
              {leftSlots.length} Slot Totali
            </span>
          </div>

          {/* Tier 3 */}
          {renderTierSection(
            "Piano 3 (Alto - 1.7m)",
            leftSlots.filter((s) => s.tier === 3),
            "S",
            3,
            "text-amber-800 bg-amber-100",
          )}

          {/* Tier 2 (Golden Zone) */}
          {renderTierSection(
            "Piano 2 (Medio - Golden Zone)",
            leftSlots.filter((s) => s.tier === 2),
            "S",
            2,
            "text-amber-800 bg-amber-100",
          )}

          {/* Tier 1 */}
          {renderTierSection(
            "Piano 1 (Basso - Terra)",
            leftSlots.filter((s) => s.tier === 1),
            "S",
            1,
            "text-amber-800 bg-amber-100",
          )}
        </div>

        {/* Right Rack (D - Destra) */}
        <div className="bg-slate-50 border-2 border-cyan-300 rounded-3xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-cyan-500" />
              <h3 className="font-black text-cyan-950 text-sm tracking-wide">
                SCAFFALE D • DESTRA (Capsule, Gocce, Nutraceutici & Volantini)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">
              {rightSlots.length} Slot Totali
            </span>
          </div>

          {/* Tier 3 */}
          {renderTierSection(
            "Piano 3 (Alto - 1.7m)",
            rightSlots.filter((s) => s.tier === 3),
            "D",
            3,
            "text-cyan-800 bg-cyan-100",
          )}

          {/* Tier 2 (Golden Zone) */}
          {renderTierSection(
            "Piano 2 (Medio - Golden Zone)",
            rightSlots.filter((s) => s.tier === 2),
            "D",
            2,
            "text-cyan-800 bg-cyan-100",
          )}

          {/* Tier 1 */}
          {renderTierSection(
            "Piano 1 (Basso - Terra)",
            rightSlots.filter((s) => s.tier === 1),
            "D",
            1,
            "text-cyan-800 bg-cyan-100",
          )}
        </div>
      </div>

      {/* Modal for Slot Reassignment & Delete */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-norsan-100 text-norsan-800 rounded-2xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Modifica Slot [{selectedSlot.slot_code}]
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedSlot.side === "S"
                      ? "Scaffale Sinistro (S)"
                      : "Scaffale Destro (D)"}{" "}
                    • Piano {selectedSlot.tier}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Seleziona Prodotto da Posizionare in questo Slot:
                </label>
                <select
                  value={chosenProductId}
                  onChange={(e) => setChosenProductId(e.target.value)}
                  className="w-full bg-white border-2 border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-norsan-600 shadow-xs"
                >
                  <option value="">
                    -- Nessun prodotto (Slot Libero / Vuoto) --
                  </option>
                  <optgroup label="--- CATALOGO NORSAN (Omega-3) ---">
                    {products
                      .filter((p) => p.brand === "NORSAN")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.volume}) - EAN: {p.ean}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="--- CATALOGO ZREEN (Nutraceutica) ---">
                    {products
                      .filter((p) => p.brand === "ZREEN")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.volume}) - EAN: {p.ean}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {chosenProductId && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center gap-3.5">
                  <Package className="w-8 h-8 text-norsan-600 flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-black text-slate-900">
                      {products.find((p) => p.id === chosenProductId)?.name}
                    </div>
                    <div className="text-slate-500 font-mono mt-0.5">
                      {
                        products.find((p) => p.id === chosenProductId)
                          ?.italianName
                      }
                    </div>
                  </div>
                </div>
              )}

              {saveSuccess && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Posizione aggiornata con successo nel database SQLite!
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteCurrentSlot(selectedSlot.slot_code)}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Elimina Slot</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveAssignment}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-norsan-600 hover:bg-norsan-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving ? "Salvataggio..." : "Conferma Assegnazione"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
