/**
 * rack/RackSlotEditPanel.tsx
 * Modal panel for Team Lead to edit product slot coordinates and upload photos.
 * Accessible only when isTeamLead=true in StationRackGuide.
 */

import React, { useState, useRef } from "react";
import { X, Pencil, Camera, Save, RotateCcw } from "lucide-react";
import { Product } from "../../types/wms";
import { SlotOverride } from "./rackTypes";

interface RackSlotEditPanelProps {
  product: Product;
  override: SlotOverride | undefined;
  onSave: (data: Partial<SlotOverride>) => void;
  onClose: () => void;
}

export const RackSlotEditPanel: React.FC<RackSlotEditPanelProps> = ({
  product,
  override,
  onSave,
  onClose,
}) => {
  const [coord, setCoord] = useState(
    override?.customCoordinate ||
      product.shelfCoordinate ||
      product.shelfLocation ||
      "",
  );
  const [notes, setNotes] = useState(override?.notes || "");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(() => {
    if (override?.customPhotoUrl) return override.customPhotoUrl;
    try {
      const customImgs = JSON.parse(
        localStorage.getItem("wms_custom_product_images") || "{}",
      );
      if (customImgs[product.id]) return customImgs[product.id];
    } catch {
      // ignore
    }
    return product.imageUrl;
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave({
      customCoordinate: coord.trim() || undefined,
      notes: notes.trim() || undefined,
      customPhotoUrl: photoUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border-2 border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-400" />
            <span className="font-black text-sm">
              Modifica Slot — Lead Only
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Prodotto
            </label>
            <div className="mt-1 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              {product.name}
              <span className="ml-2 text-xs font-mono text-slate-500">
                SKU: {product.sku}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Coordinata Scaffale
            </label>
            <input
              type="text"
              value={coord}
              onChange={(e) => setCoord(e.target.value)}
              placeholder="es. D-38, N-A1, A-11..."
              className="mt-1 w-full border-2 border-slate-300 focus:border-amber-400 outline-none rounded-xl px-3 py-2 font-mono text-sm font-bold transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Note per il Packer
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="es. Attenzione: scatola fragile, posizionare in fondo..."
              className="mt-1 w-full border-2 border-slate-300 focus:border-amber-400 outline-none rounded-xl px-3 py-2 text-sm resize-none transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
              Foto Prodotto / Slot
            </label>
            <div className="mt-1 flex gap-3 items-start">
              {photoUrl ? (
                <div className="relative">
                  <img
                    src={photoUrl}
                    alt="preview"
                    className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-400 shadow-sm"
                  />
                  <button
                    onClick={() => setPhotoUrl(undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition"
                >
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-[9px] text-slate-400 font-bold text-center">
                    Carica
                    <br />
                    foto
                  </span>
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl transition border border-slate-300"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {photoUrl ? "Cambia foto" : "Carica foto"}
                </button>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Foto dello slot fisico o del prodotto. Visibile ai packer
                  nella mappa.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Annulla
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm transition flex items-center justify-center gap-1.5 shadow-md"
          >
            <Save className="w-3.5 h-3.5" /> Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};
