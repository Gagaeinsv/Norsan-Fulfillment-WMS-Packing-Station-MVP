import React, { useState, useMemo, useRef } from "react";
import {
  MapPin,
  Sparkles,
  ArrowRight,
  Layers,
  Save,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  Camera,
  RotateCcw,
  Search,
  ArrowLeftRight,
  Zap,
} from "lucide-react";
import { Product } from "../../types/wms";
import { WarehouseSlotData } from "../rack/rackTypes";

export type { WarehouseSlotData };

interface SlottingManagerProps {
  slots: WarehouseSlotData[];
  products: Product[];
  stationConfigId?: string;
  onAssignSlot: (slotCode: string, productId: string | null) => Promise<void>;
  onAddSlot: (side: "S" | "D", tier: 1 | 2 | 3) => Promise<void>;
  onDeleteSlot: (slotCode: string) => Promise<void>;
  onUpdateProductImage?: (productId: string, imageUrl: string) => void;
  onResetSlotsToDefault?: () => void;
}

export const SlottingManager: React.FC<SlottingManagerProps> = ({
  slots,
  products,
  stationConfigId = "STATION_01",
  onAssignSlot,
  onAddSlot,
  onDeleteSlot,
  onUpdateProductImage,
  onResetSlotsToDefault,
}) => {
  // Local station perspective switch (ST-01 vs ST-02)
  const [activeStation, setActiveStation] = useState<string>(stationConfigId);
  const isStation1 = activeStation === "STATION_01";

  // Filter and search state
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("all");
  const [occupancyFilter, setOccupancyFilter] = useState<
    "all" | "occupied" | "free"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selectedSlot, setSelectedSlot] = useState<WarehouseSlotData | null>(
    null,
  );
  const [chosenProductId, setChosenProductId] = useState<string>("");
  const [slotPhotoPreview, setSlotPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Photo studio modal state
  const [isPhotoStudioOpen, setIsPhotoStudioOpen] = useState(false);
  const [photoStudioSearch, setPhotoStudioSearch] = useState("");
  const [photoStudioBrand, setPhotoStudioBrand] = useState<
    "ALL" | "NORSAN" | "ZREEN"
  >("ALL");

  // File upload refs
  const slotFileInputRef = useRef<HTMLInputElement | null>(null);
  const studioFileInputRef = useRef<HTMLInputElement | null>(null);
  const [studioTargetProduct, setStudioTargetProduct] =
    useState<Product | null>(null);

  // Custom photo map from localStorage
  const customImagesMap = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("wms_custom_product_images") || "{}",
      );
    } catch {
      return {};
    }
  }, [products]);

  // Handle open slot edit modal
  const handleOpenAssignModal = (slot: WarehouseSlotData) => {
    setSelectedSlot(slot);
    setChosenProductId(slot.product_id || "");
    const prod = products.find((p) => p.id === slot.product_id);
    const customImg = slot.product_id
      ? customImagesMap[slot.product_id]
      : null;
    setSlotPhotoPreview(customImg || slot.product_image_url || prod?.imageUrl || null);
    setSaveSuccess(false);
  };

  // Handle photo file selection in slot modal
  const handleSlotPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSlotPhotoPreview(dataUrl);
      if (chosenProductId && onUpdateProductImage) {
        onUpdateProductImage(chosenProductId, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle saving slot assignment
  const handleSaveAssignment = async () => {
    if (!selectedSlot) return;
    setIsSaving(true);
    try {
      if (chosenProductId && slotPhotoPreview && onUpdateProductImage) {
        onUpdateProductImage(chosenProductId, slotPhotoPreview);
      }
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

  // Handle delete physical slot
  const handleDeleteCurrentSlot = async (slotCode: string) => {
    if (
      confirm(
        `Sei sicuro di voler eliminare lo slot fisico [${slotCode}] dalla mappa?`,
      )
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

  // Handle direct photo change in Photo Studio
  const handleStudioFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studioTargetProduct || !onUpdateProductImage) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onUpdateProductImage(studioTargetProduct.id, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProductPhoto = (productId: string) => {
    if (onUpdateProductImage) {
      // Revert to original product image by empty custom image
      const defaultProd = products.find((p) => p.id === productId);
      if (defaultProd) {
        onUpdateProductImage(productId, defaultProd.imageUrl);
      }
    }
    // Also remove from localStorage custom images
    try {
      const saved = JSON.parse(
        localStorage.getItem("wms_custom_product_images") || "{}",
      );
      delete saved[productId];
      localStorage.setItem("wms_custom_product_images", JSON.stringify(saved));
    } catch {
      // ignore
    }
  };

  // Filter slots based on search and filters
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      // Tier filter
      if (selectedTierFilter !== "all") {
        if (selectedTierFilter === "NORSAN") {
          if (!slot.slot_code.startsWith("N-A")) {
            return false;
          }
        } else if (selectedTierFilter === "A") {
          if (!slot.slot_code.startsWith("A-")) return false;
        } else if (selectedTierFilter === "B") {
          if (!slot.slot_code.startsWith("B-")) return false;
        } else if (selectedTierFilter === "C") {
          if (!slot.slot_code.startsWith("C-")) return false;
        } else if (selectedTierFilter === "D") {
          if (!slot.slot_code.startsWith("D-")) return false;
        }
      }

      // Occupancy filter
      const isOccupied = !!slot.product_id;
      if (occupancyFilter === "occupied" && !isOccupied) return false;
      if (occupancyFilter === "free" && isOccupied) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = slot.slot_code.toLowerCase().includes(q);
        const nameMatch = (slot.product_name || "").toLowerCase().includes(q);
        const eanMatch = (slot.product_ean || "").toLowerCase().includes(q);
        const brandMatch = (slot.product_brand || "").toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !eanMatch && !brandMatch) return false;
      }

      return true;
    });
  }, [slots, selectedTierFilter, occupancyFilter, searchQuery]);

  // Categorize slots by real physical groups:
  // Norsan Shelf: N-A (Oli, flaconi, capsule, gocce)
  const norsanSlots = filteredSlots.filter(
    (s) => s.slot_code.startsWith("N-A"),
  );
  // Zreen Shelves: Tiers A, B, C, D
  const zreenTierASlots = filteredSlots.filter((s) => s.slot_code.startsWith("A-"));
  const zreenTierBSlots = filteredSlots.filter((s) => s.slot_code.startsWith("B-"));
  const zreenTierCSlots = filteredSlots.filter((s) => s.slot_code.startsWith("C-"));
  const zreenTierDSlots = filteredSlots.filter((s) => s.slot_code.startsWith("D-"));

  // Legacy fallback if old slots (S / D with 1/2/3) are still present
  const legacyLeftSlots = filteredSlots.filter(
    (s) =>
      s.side === "S" &&
      !s.slot_code.startsWith("N-A") &&
      !s.slot_code.startsWith("A-") &&
      !s.slot_code.startsWith("B-") &&
      !s.slot_code.startsWith("C-") &&
      !s.slot_code.startsWith("D-"),
  );
  const legacyRightSlots = filteredSlots.filter(
    (s) =>
      s.side === "D" &&
      !s.slot_code.startsWith("N-A") &&
      !s.slot_code.startsWith("A-") &&
      !s.slot_code.startsWith("B-") &&
      !s.slot_code.startsWith("C-") &&
      !s.slot_code.startsWith("D-"),
  );

  // Statistics
  const totalSlotsCount = slots.length;
  const occupiedSlotsCount = slots.filter((s) => !!s.product_id).length;
  const freeSlotsCount = totalSlotsCount - occupiedSlotsCount;
  const customPhotosCount = Object.keys(customImagesMap).length;

  // Render an individual slot card
  const renderSlotCard = (slot: WarehouseSlotData) => {
    const isOccupied = !!slot.product_id;
    const isZreen = slot.product_brand === "ZREEN" || slot.slot_code.startsWith("A-") || slot.slot_code.startsWith("B-") || slot.slot_code.startsWith("C-") || slot.slot_code.startsWith("D-");
    const isFlyerSlot = slot.slot_code === "N-A8" || slot.slot_code === "D3-J" || slot.slot_code === "D3-C";
    const isP2L = slot.slot_code.startsWith("D-");
    const hasCustomPhoto = slot.product_id && customImagesMap[slot.product_id];
    const displayImg = slot.product_id && customImagesMap[slot.product_id]
      ? customImagesMap[slot.product_id]
      : slot.product_image_url;

    return (
      <div
        key={slot.slot_code}
        onClick={() => !isFlyerSlot && handleOpenAssignModal(slot)}
        className={`p-2 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[120px] shadow-xs relative group ${
          isFlyerSlot
            ? "bg-cyan-50/90 border-cyan-300 cursor-default"
            : isOccupied
              ? "bg-white border-slate-300 hover:border-norsan-600 hover:shadow-md cursor-pointer"
              : "bg-slate-50/70 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer hover:bg-slate-100"
        }`}
      >
        {/* Top: Slot code, Badges & Quick Actions */}
        <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-200">
          <div className="flex items-center gap-1">
            <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-slate-900 text-white shadow-xs">
              {slot.slot_code}
            </span>
            {isP2L && (
              <span className="text-[8px] font-black bg-amber-400 text-slate-950 px-1 py-0.5 rounded flex items-center gap-0.5" title="Pick-to-Light LED strip">
                <Zap className="w-2.5 h-2.5 text-amber-900 fill-amber-900" /> P2L
              </span>
            )}
          </div>

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
                {slot.product_brand || (isZreen ? "ZREEN" : "NORSAN")}
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

        {/* Center: Product Details */}
        {isFlyerSlot ? (
          <div className="my-1.5 text-[10px]">
            <div className="font-black text-cyan-950 line-clamp-1">
              Opuscoli NORSAN & ZREEN
            </div>
            <div className="text-[9px] text-cyan-700">Slot Volantini Tavolo</div>
          </div>
        ) : isOccupied ? (
          <div className="my-1.5 flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <img
                src={displayImg || ""}
                alt=""
                className="w-10 h-10 rounded-xl object-cover border border-slate-300 bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100&auto=format&fit=crop&q=60";
                }}
              />
              {hasCustomPhoto && (
                <div
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[7px] font-black border border-white shadow-xs"
                  title="Foto personalizzata caricata dal Team Lead"
                >
                  ✓
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-slate-900 line-clamp-2 leading-tight">
                {slot.product_name}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                {slot.product_ean}
              </div>
            </div>
          </div>
        ) : (
          <div className="my-2.5 text-center text-slate-400 text-[10px] italic font-medium">
            + Clicca per assegnare
          </div>
        )}

        {/* Bottom footer bar */}
        {!isFlyerSlot && (
          <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
            <span className="truncate max-w-[70px] font-medium">
              {isOccupied ? slot.product_volume || "Assegnato" : "Slot vuoto"}
            </span>
            <span className="font-bold text-norsan-700 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Modifica <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        )}
      </div>
    );
  };

  // Section builder for a tier
  const renderTierSection = (
    title: string,
    sublabel: string,
    tierSlots: WarehouseSlotData[],
    badgeText: string,
    badgeColor: string,
    onAddClick?: () => void,
  ) => {
    if (tierSlots.length === 0 && selectedTierFilter !== "all") return null;

    return (
      <div className="space-y-2 bg-white/70 p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-xs px-2 py-0.5 rounded-lg font-black ${badgeColor}`}>
              {badgeText}
            </span>
            <div>
              <div className="text-xs font-black text-slate-800 leading-tight">
                {title}
              </div>
              <div className="text-[10px] text-slate-500">{sublabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
              {tierSlots.filter((s) => s.product_id).length}/{tierSlots.length} occupati
            </span>
            {onAddClick && (
              <button
                type="button"
                onClick={onAddClick}
                className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-black px-2 py-0.5 rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Aggiungi slot supplementare in questo piano"
              >
                <Plus className="w-3 h-3 text-amber-300" />
                <span>+ Slot</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {tierSlots.map((s) => renderSlotCard(s))}
        </div>
      </div>
    );
  };

  // Render Shelf Component (Norsan vs Zreen)
  const renderNorsanShelf = () => (
    <div className="bg-slate-50 border-2 border-cyan-400 rounded-3xl p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-600 ring-2 ring-cyan-200" />
          <div>
            <h3 className="font-black text-cyan-950 text-sm tracking-wide">
              SCAFFALE NORSAN (Oli Liquidi & Flaconi Vetro)
            </h3>
            <p className="text-[11px] text-cyan-800">
              {isStation1 ? "Posizione: SINISTRA ⬅️ (Tavolo 1)" : "Posizione: DESTRA ➡️ (Tavolo 2)"}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-cyan-900 bg-cyan-100 font-bold px-2 py-0.5 rounded-lg border border-cyan-200">
          {norsanSlots.length} Slot Totali
        </span>
      </div>

      {/* Tier N-A (Oli & Flaconi) */}
      {/* Tier N-A (Oli, Flaconi, Capsule & Gocce) */}
      {renderTierSection(
        "Piano N-A (Slot N-A1..N-A11)",
        "Scaffale NORSAN: Oli di Pesce/Algali, Flaconi, Capsule & Gocce",
        norsanSlots.filter((s) => s.slot_code.startsWith("N-A")),
        "N-A (1..11)",
        "bg-cyan-100 text-cyan-900 border border-cyan-300",
        () => onAddSlot("S", 2),
      )}

      {/* Volantini & Marketing Flyers (Sul Banco Imballaggio) */}
      <div className="bg-cyan-50/70 border-2 border-dashed border-cyan-300 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-xs text-cyan-950 flex items-center gap-1.5">
            <span>📄</span> Volantini & Pubblicità (Sul Banco Imballaggio)
          </span>
          <span className="text-[10px] text-cyan-800 font-bold bg-white px-2 py-0.5 rounded-full border border-cyan-200">
            Solo Pubblicità sul Banco
          </span>
        </div>
        <p className="text-[10px] text-cyan-800">
          Sul banco imballaggio è posizionato <strong>esclusivamente materiale pubblicitario</strong> (FLY-NOR-ITA, FLY-ZRE-NUTRA, cartoline sconto). Nessun prodotto è stoccato sul banco.
        </p>
      </div>
    </div>
  );

  const renderZreenShelf = () => (
    <div className="bg-slate-50 border-2 border-emerald-400 rounded-3xl p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200" />
          <div>
            <h3 className="font-black text-emerald-950 text-sm tracking-wide">
              SCAFFALE ZREEN 5-TIER (Nutraceutica Condivisa)
            </h3>
            <p className="text-[11px] text-emerald-800">
              {isStation1 ? "Posizione: DESTRA ➡️ (Tavolo 1)" : "Posizione: SINISTRA ⬅️ (Tavolo 2)"}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-emerald-900 bg-emerald-100 font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
          {zreenTierASlots.length + zreenTierBSlots.length + zreenTierCSlots.length + zreenTierDSlots.length} Slot Attivi
        </span>
      </div>

      {/* Tier A (Alto) */}
      {renderTierSection(
        "Tier A • Alto (1.8m - 24 Slot)",
        "Aminoacidi, Proteine, Polveri & Barattoli ZREEN",
        zreenTierASlots,
        "TIER A",
        "bg-emerald-100 text-emerald-900 border border-emerald-300",
        () => onAddSlot("D", 3),
      )}

      {/* Tier B (Medio-Alto) */}
      {renderTierSection(
        "Tier B • Medio-Alto (1.4m - 24 Slot)",
        "Capsule & Blister Nutraceutica Premium",
        zreenTierBSlots,
        "TIER B",
        "bg-green-100 text-green-900 border border-green-300",
        () => onAddSlot("D", 3),
      )}

      {/* Tier C (Medio) */}
      {renderTierSection(
        "Tier C • Medio (1.0m - 15 Slot)",
        "Estratti Puri, Flaconcini & Vitamine",
        zreenTierCSlots,
        "TIER C",
        "bg-yellow-100 text-yellow-900 border border-yellow-300",
        () => onAddSlot("D", 2),
      )}

      {/* Tier D (Basso - P2L) */}
      {renderTierSection(
        "Tier D • Basso Pick-to-Light (0.6m - 38 Slot)",
        "Zona Ergonomica P2L con barra LED indirizzabile WS2812B",
        zreenTierDSlots,
        "TIER D P2L",
        "bg-orange-100 text-orange-950 border border-orange-300",
        () => onAddSlot("D", 1),
      )}

      {/* Tier E (Pavimento) */}
      <div className="bg-slate-100 border border-slate-300 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <div>
            <div className="text-xs font-black text-slate-700">Tier E — Pavimento & Riserva Sfuso</div>
            <div className="text-[10px] text-slate-500">Pallet e scorte di riserva (non picking diretto)</div>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
          Stock Pallet
        </span>
      </div>
    </div>
  );

  return (
    <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 space-y-5 shadow-sm select-none">
      {/* 1. Header with Title, Station Toggle & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-slate-900">
                Mappa Scaffali & Slotting 5-Tier (Hub Bolzano)
              </h2>
              <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2.5 py-0.5 rounded-full font-mono">
                {totalSlotsCount} SLOT ATTIVI
              </span>
              <span className="text-xs bg-cyan-100 text-cyan-900 border border-cyan-300 font-black px-2 py-0.5 rounded-full font-mono">
                {occupiedSlotsCount} ASSEGNATI
              </span>
              <span className="text-xs bg-slate-100 text-slate-700 border border-slate-300 font-black px-2 py-0.5 rounded-full font-mono">
                {freeSlotsCount} LIBERI
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Configurazione reale 5-Tier: NORSAN (Oli & Tavolo Fast-Pick) + ZREEN (Tier A/B/C/D Pick-to-Light).
            </p>
          </div>
        </div>

        {/* Station Toggle & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-300">
            <button
              type="button"
              onClick={() => setActiveStation("STATION_01")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                isStation1
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>ST-01 (Tavolo 1)</span>
              <span className="text-[10px] text-cyan-300 font-normal">⬅️ NOR | ZRE ➡️</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStation("STATION_02")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                !isStation1
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>ST-02 (Tavolo 2)</span>
              <span className="text-[10px] text-emerald-300 font-normal">⬅️ ZRE | NOR ➡️</span>
            </button>
          </div>

          {/* Photo Studio Button */}
          <button
            type="button"
            onClick={() => setIsPhotoStudioOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs transition shadow-xs cursor-pointer border border-amber-600"
          >
            <Camera className="w-4 h-4 text-slate-950" />
            <span>📸 Catalogo Foto Prodotti ({customPhotosCount})</span>
          </button>

          {/* Reset Layout Button */}
          {onResetSlotsToDefault && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Vuoi ripristinare la mappa agli slot standard ufficiali di Bolzano Hub?")) {
                  onResetSlotsToDefault();
                }
              }}
              className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-300 cursor-pointer"
              title="Ripristina layout predefinito"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Ripristina Hub</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Bar & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        {/* Tier Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "Tutti i Piani" },
            { id: "NORSAN", label: "Scaffale NORSAN (N-A)" },
            { id: "A", label: "ZREEN Tier A" },
            { id: "B", label: "ZREEN Tier B" },
            { id: "C", label: "ZREEN Tier C" },
            { id: "D", label: "ZREEN Tier D (P2L)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTierFilter(tab.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedTierFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs font-black"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Occupancy and Search */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
          <div className="flex items-center bg-white rounded-xl border border-slate-300 p-0.5 text-xs">
            <button
              onClick={() => setOccupancyFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                occupancyFilter === "all" ? "bg-slate-800 text-white" : "text-slate-600"
              }`}
            >
              Tutti
            </button>
            <button
              onClick={() => setOccupancyFilter("occupied")}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                occupancyFilter === "occupied" ? "bg-emerald-600 text-white" : "text-slate-600"
              }`}
            >
              Occupati
            </button>
            <button
              onClick={() => setOccupancyFilter("free")}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                occupancyFilter === "free" ? "bg-amber-600 text-white" : "text-slate-600"
              }`}
            >
              Liberi
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca SKU, nome o slot..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:border-norsan-600"
            />
          </div>
        </div>
      </div>

      {/* 3. Physical Warehouse Racks (Mirror layout based on Station) */}
      <div className="space-y-6">
        {/* Packing Table Center Banner */}
        <div className="bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between text-xs font-black shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-cyan-300">
              {isStation1 ? "⬅️ LATO SINISTRO (SCAFFALE NORSAN)" : "⬅️ LATO SINISTRO (SCAFFALE ZREEN)"}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
            <span>BANCO IMBALLAGGIO ({activeStation}) — PC + SCANNER + SOLO PUBBLICITÀ/VOLANTINI</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-300">
              {isStation1 ? "LATO DESTRO (SCAFFALE ZREEN) ➡️" : "LATO DESTRO (SCAFFALE NORSAN) ➡️"}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>

        {/* Shelves Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Side */}
          {isStation1 ? renderNorsanShelf() : renderZreenShelf()}

          {/* Right Side */}
          {isStation1 ? renderZreenShelf() : renderNorsanShelf()}
        </div>

        {/* Legacy Shelves fallback if custom S/D slots remain */}
        {(legacyLeftSlots.length > 0 || legacyRightSlots.length > 0) && (
          <div className="mt-6 border-t-2 border-slate-200 pt-4 space-y-4">
            <div className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Slot Personalizzati Aggiuntivi (S / D)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {legacyLeftSlots.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-700">Sinistra (S) Extra</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {legacyLeftSlots.map(renderSlotCard)}
                  </div>
                </div>
              )}
              {legacyRightSlots.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-700">Destra (D) Extra</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {legacyRightSlots.map(renderSlotCard)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Modal for Slot Assignment & Direct Photo Upload */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
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
                    {selectedSlot.description || `Posizione ${selectedSlot.slot_code}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Product Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Prodotto da Assegnare allo Slot:
                </label>
                <select
                  value={chosenProductId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setChosenProductId(newId);
                    const prod = products.find((p) => p.id === newId);
                    const customImg = newId ? customImagesMap[newId] : null;
                    setSlotPhotoPreview(customImg || prod?.imageUrl || null);
                  }}
                  className="w-full bg-white border-2 border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-norsan-600 shadow-xs"
                >
                  <option value="">
                    -- Nessun prodotto (Slot Libero / Vuoto) --
                  </option>
                  <optgroup label="--- CATALOGO NORSAN (Oli & Capsule) ---">
                    {products
                      .filter((p) => p.brand === "NORSAN")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.volume}) — SKU: {p.sku}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="--- CATALOGO ZREEN (Nutraceutica) ---">
                    {products
                      .filter((p) => p.brand === "ZREEN")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.volume}) — SKU: {p.sku}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Photo Upload Feature for Team Lead */}
              {chosenProductId && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-500" />
                      <span>Foto Prodotto (Scatta / Carica per i Packer)</span>
                    </label>
                    {customImagesMap[chosenProductId] && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                        Foto Personalizzata Attiva
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-4">
                    {/* Thumbnail Preview */}
                    <div className="relative group/thumb">
                      <img
                        src={
                          slotPhotoPreview ||
                          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=150&auto=format&fit=crop&q=80"
                        }
                        alt="Product preview"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-300 bg-white shadow-xs"
                      />
                    </div>

                    {/* Upload Controls */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => slotFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-300" />
                          <span>Scatta / Carica Foto</span>
                        </button>

                        {slotPhotoPreview && customImagesMap[chosenProductId] && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProductPhoto(chosenProductId)}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                          >
                            Resetta Default
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 leading-tight">
                        La foto caricata sarà visibile immediatamente ai packer sul banco durante lo scansionamento dell&apos;ordine e nella mappa scaffali.
                      </p>

                      <input
                        ref={slotFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleSlotPhotoUpload}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback Success Badge */}
              {saveSuccess && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Posizione e foto salvate con successo nel sistema WMS!</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteCurrentSlot(selectedSlot.slot_code)}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Elimina Slot</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-norsan-600 hover:bg-norsan-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
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

      {/* 5. Dedicated "Catalogo Foto Prodotti" Studio Modal */}
      {isPhotoStudioOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Studio Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Gestore Foto Prodotti per il Team Lead
                  </h3>
                  <p className="text-xs text-slate-500">
                    Carica o scatta foto reali per ciascun prodotto del catalogo Bolzano.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoStudioOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Studio Filters */}
            <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {(["ALL", "NORSAN", "ZREEN"] as const).map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setPhotoStudioBrand(brand)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      photoStudioBrand === brand
                        ? "bg-slate-900 text-white font-black"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {brand === "ALL" ? "Tutti i Brand" : brand}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={photoStudioSearch}
                  onChange={(e) => setPhotoStudioSearch(e.target.value)}
                  placeholder="Cerca prodotto o SKU..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-norsan-600"
                />
              </div>
            </div>

            {/* Studio Product Grid */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {products
                .filter((p) => {
                  if (photoStudioBrand !== "ALL" && p.brand !== photoStudioBrand) {
                    return false;
                  }
                  if (photoStudioSearch.trim()) {
                    const q = photoStudioSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.sku.toLowerCase().includes(q) ||
                      p.ean.includes(q)
                    );
                  }
                  return true;
                })
                .map((prod) => {
                  const hasCustom = !!customImagesMap[prod.id];
                  const currentImg = customImagesMap[prod.id] || prod.imageUrl;

                  return (
                    <div
                      key={prod.id}
                      className="bg-slate-50 border border-slate-300 rounded-2xl p-3 flex flex-col justify-between space-y-2 hover:border-slate-400 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={currentImg}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover border border-slate-300 bg-white"
                          />
                          {hasCustom && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border border-white">
                              ✓
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                                prod.brand === "NORSAN"
                                  ? "bg-cyan-100 text-cyan-900"
                                  : "bg-emerald-100 text-emerald-900"
                              }`}
                            >
                              {prod.brand}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-500">
                              [{prod.shelfCoordinate || prod.shelfLocation || "N/A"}]
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-900 line-clamp-2 leading-tight mt-0.5">
                            {prod.name}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                            {prod.sku} • {prod.ean}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setStudioTargetProduct(prod);
                            studioFileInputRef.current?.click();
                          }}
                          className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-amber-300" />
                          <span>{hasCustom ? "Cambia Foto" : "Carica Foto"}</span>
                        </button>

                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProductPhoto(prod.id)}
                            className="py-1.5 px-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-[10px] font-bold transition cursor-pointer"
                            title="Ripristina foto default"
                          >
                            Resetta
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Hidden Studio Input */}
            <input
              ref={studioFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleStudioFileSelected}
            />

            {/* Studio Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Tutte le foto modificate vengono salvate localmente nel browser del terminale.
              </span>
              <button
                type="button"
                onClick={() => setIsPhotoStudioOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition cursor-pointer"
              >
                Chiudi Catalogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
