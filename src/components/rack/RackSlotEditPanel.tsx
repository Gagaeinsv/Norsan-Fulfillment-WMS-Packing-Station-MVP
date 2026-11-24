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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200/90 overflow-hidden">
        <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-900">
              Modifica Slot · Lead Only
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 bg-[#f4f6f9]">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Prodotto
            </label>
            <div className="mt-1 text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2">
              {product.name}
              <span className="ml-2 text-xs font-mono text-slate-500 font-medium">
                SKU: {product.sku}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Coordinata Scaffale
            </label>
            <input
              type="text"
              value={coord}
              onChange={(e) => setCoord(e.target.value)}
              placeholder="es. D-38, N-A1, A-11..."
              className="mt-1 w-full bg-white border border-slate-300 focus:border-norsan-600 outline-none rounded-xl px-3 py-2 font-mono text-sm font-bold transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Note per il Packer
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="es. Attenzione: scatola fragile, posizionare in fondo..."
              className="mt-1 w-full bg-white border border-slate-300 focus:border-norsan-600 outline-none rounded-xl px-3 py-2 text-sm resize-none transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Foto Prodotto / Slot
            </label>
            <div className="mt-1.5 flex gap-3 items-start bg-white p-3 rounded-xl border border-slate-200">
              {photoUrl ? (
                <div className="relative">
                  <img
                    src={photoUrl}
                    alt="preview"
                    className="w-20 h-20 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-norsan-500 hover:bg-norsan-50/40 transition"
                >
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-[9px] text-slate-400 font-semibold text-center">
                    Carica
                    <br />
                    foto
                  </span>
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold px-3 py-2 rounded-xl transition border border-slate-200 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{photoUrl ? "Cambia foto" : "Carica foto"}</span>
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

        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Annulla</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salva Modifiche</span>
          </button>
        </div>
      </div>
    </div>
  );
};
