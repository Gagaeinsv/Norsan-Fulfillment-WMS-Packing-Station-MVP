import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  FileText,
  AlertOctagon,
  Printer,
  Scale,
  ChevronRight,
  ShieldCheck,
  Box,
  Flame,
  ShieldAlert,
  Sparkles,
  Check,
  Barcode,
  BookOpen,
  Timer,
  Boxes,
  BellRing,
  Repeat
} from 'lucide-react';
import { Order, BoxType } from '../types/wms';
import { BOX_TYPES } from '../data/norsanProducts';

interface ActivePackingViewProps {
  order: Order;
  onSimulateScan: (barcode: string, quantity?: number) => void;
  onToggleFlyer?: (flyerId: string) => void;
  onOpenLabelModal: () => void;
  onOpenIssueModal: () => void;
  onChangeBoxType: (boxType: BoxType) => void;
  stationConfigId: string;
  onToggleGift?: () => void;
  onTogglePhysicalDocument?: () => void;
}

export const ActivePackingView: React.FC<ActivePackingViewProps> = ({
  order,
  onSimulateScan,
  onToggleFlyer,
  onOpenLabelModal,
  onOpenIssueModal,
  onChangeBoxType,
  stationConfigId,
  onToggleGift,
  onTogglePhysicalDocument,
}) => {
  // Calculations
  const totalItemsRequired = order.items.reduce((sum, it) => sum + it.quantityRequired, 0);
  const totalItemsScanned = order.items.reduce((sum, it) => sum + it.quantityScanned, 0);
  const isProductsFullyScanned = order.items.length > 0 &&
    order.items.every(it => it.quantityScanned >= it.quantityRequired);
  
  const isFlyersFullyScanned = order.marketingFlyers.every(f => f.isIncluded);
  const requiresGift = order.retentionGift && order.retentionGift !== 'none';
  const isGiftConfirmed = !requiresGift || order.giftConfirmed;
  const isPhysicalDocumentConfirmed = !order.requiresPhysicalDocument || order.physicalDocumentConfirmed;

  // Marketing flyers and gifts are now mandatory per Subscription and MVP requirements
  const isOrderFullyReady = isProductsFullyScanned && isFlyersFullyScanned && isGiftConfirmed && isPhysicalDocumentConfirmed;
  const overallProgress = totalItemsRequired > 0 ? Math.round((totalItemsScanned / totalItemsRequired) * 100) : 0;

  // Total weight estimate
  const productsWeightGrams = order.items.reduce((sum, it) => sum + (it.product.weightGrams * it.quantityScanned), 0);
  const totalGrossWeight = productsWeightGrams + 180;

  // Selected Box details
  const selectedBox = BOX_TYPES.find(b => b.id === order.boxRecommendation) || BOX_TYPES[1];
  const requiredFlyer = order.marketingFlyers[0];

  // Lean Takt Time & Cycle Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const targetTaktSeconds = totalItemsRequired > 5 ? 75 : 40; // 40s for retail, 75s for bulk

  useEffect(() => {
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [order.id]);

  const isOverTaktTime = elapsedSeconds > targetTaktSeconds;
  const isNearTaktTime = elapsedSeconds > targetTaktSeconds * 0.75 && !isOverTaktTime;

  // Kanban replenishment alert feedback state
  const [kanbanAlertItem, setKanbanAlertItem] = useState<string | null>(null);

  const handleTriggerKanbanRefill = (_productName: string, slotCode: string) => {
    setKanbanAlertItem(slotCode);
    setTimeout(() => setKanbanAlertItem(null), 2500);
  };

  return (
    <div className="flex flex-col h-full space-y-3 select-none">
      {/* Top Header Bar: Clean, symmetrical, balanced 2-column layout */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left Side: Order Meta & Customer Info */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300">
            <FileText className="w-4 h-4 text-norsan-600" />
            <span className="font-mono text-base font-black text-slate-900">
              {order.orderNumber}
            </span>
          </div>

          <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <span>{order.customerName}</span>
            <span className="text-slate-300">â€¢</span>
            <span className="text-slate-700 font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              {order.customerCity}
            </span>
          </div>

          <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded-lg flex items-center gap-1 uppercase">
            <Truck className="w-3.5 h-3.5 text-amber-700" /> {order.courier}
          </span>

          {order.priority === 'urgent' && (
            <span className="text-xs bg-rose-100 text-rose-800 border border-rose-300 font-black px-2.5 py-1 rounded-lg flex items-center gap-1 uppercase">
              <Flame className="w-3.5 h-3.5 text-rose-600" /> Urgente
            </span>
          )}

          {order.isSubscription && (
            <span className="text-xs bg-indigo-100 text-indigo-900 border border-indigo-300 font-black px-2.5 py-1 rounded-lg flex items-center gap-1 uppercase">
              <Repeat className="w-3.5 h-3.5 text-indigo-600" /> Cliente Ricorrente / Abbonato (Mese #{order.subscriptionCycle || 1})
            </span>
          )}

          {/* Lean Takt Time Pace Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold ${
            isOverTaktTime
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : isNearTaktTime
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <Timer className="w-3.5 h-3.5" />
            <span>{elapsedSeconds}s / {targetTaktSeconds}s</span>
            <span className="text-[10px] uppercase font-black tracking-wider">
              {isOverTaktTime ? 'Ritmo +15s' : 'In Ritmo Lean'}
            </span>
          </div>
        </div>

        {/* Right Side: Box Selection + Weight + Flyer Reminder */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Box Type Selector with Brand Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-sm font-black shadow-xs ${
            selectedBox.branding === 'norsan_logo'
              ? 'bg-cyan-50 border-norsan-400 text-norsan-950'
              : selectedBox.branding === 'zreen_logo'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
              : 'bg-amber-50 border-amber-400 text-amber-950'
          }`}>
            <Box className="w-4 h-4 text-slate-700" />
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs ${selectedBox.badgeColor}`}>
              {selectedBox.branding === 'norsan_logo' ? 'NORSAN' : selectedBox.branding === 'zreen_logo' ? 'ZREEN' : 'AMAZON'}
            </span>
            <select
              value={order.boxRecommendation}
              onChange={(e) => onChangeBoxType(e.target.value as BoxType)}
              className="bg-transparent text-sm font-black text-slate-900 focus:outline-none cursor-pointer pr-1"
            >
              <optgroup label="1. Scatole NORSAN">
                {BOX_TYPES.filter(b => b.branding === 'norsan_logo').map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
              <optgroup label="2. Scatole ZREEN">
                {BOX_TYPES.filter(b => b.branding === 'zreen_logo').map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
              <optgroup label="3. Scatole Neutre Amazon">
                {BOX_TYPES.filter(b => b.branding === 'neutral_unbranded').map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Scale Weight & Progress */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold">
            <span className="text-slate-800">{totalItemsScanned}/{totalItemsRequired} pz ({overallProgress}%)</span>
            <span className="text-slate-300">â€¢</span>
            <span className="text-emerald-700 font-black flex items-center gap-1 text-sm">
              <Scale className="w-4 h-4 text-emerald-600" />
              {(totalGrossWeight / 1000).toFixed(2)} kg
            </span>
          </div>

          {/* Marketing Flyer Pills */}
          {order.marketingFlyers.map(flyer => (
            <button
              key={flyer.id}
              type="button"
              onClick={() => onToggleFlyer?.(flyer.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition active:scale-95 ${
                flyer.isIncluded
                  ? 'bg-emerald-50 border border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border border-rose-300 text-rose-950 shadow-sm ring-2 ring-rose-500/20'
              }`}
              title={`Volantino OBBLIGATORIO: ${flyer.title} (Slot ${flyer.shelfLocation})`}
            >
              <BookOpen className={`w-3.5 h-3.5 ${flyer.isIncluded ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-black ${flyer.isIncluded ? 'bg-emerald-200/90' : 'bg-rose-200/90'}`}>[{flyer.shelfLocation}]</span>
              <span className="truncate max-w-[140px] font-semibold">{flyer.title}</span>
              {flyer.isIncluded ? <span className="text-emerald-600 font-black">✓</span> : <span className="text-rose-600 font-black text-lg leading-none">*</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Special Notes Banner for WhatsApp / Telefono */}
      {order.source === 'WhatsApp / Telefono' && order.specialNotes && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 p-3 rounded-r flex items-start gap-3 shadow-sm">
          <AlertOctagon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-black text-sm uppercase">Nota Speciale (Ordine Telefonico/WhatsApp)</div>
            <div className="text-sm font-semibold mt-1">{order.specialNotes}</div>
          </div>
        </div>
      )}

      {/* Physical Document Request Banner (Print-on-Demand) */}
      {order.requiresPhysicalDocument && (
        <div className={`p-3 rounded-xl border-2 flex items-center justify-between shadow-sm ${
          order.physicalDocumentConfirmed 
            ? 'bg-emerald-50 border-emerald-400' 
            : 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">📄</div>
            <div>
              <div className={`font-black text-sm ${order.physicalDocumentConfirmed ? 'text-emerald-800' : 'text-rose-900'}`}>
                OBBLIGATORIO: Stampare e inserire Fattura / DDT cartaceo
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-0.5">
                Richiesta del cliente o documento B2B
              </div>
            </div>
          </div>
          <button
            onClick={onTogglePhysicalDocument}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all active:scale-95 ${
              order.physicalDocumentConfirmed
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
              order.physicalDocumentConfirmed ? 'border-white bg-emerald-500' : 'border-slate-300 bg-white'
            }`}>
              {order.physicalDocumentConfirmed && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span>Documento inserito</span>
          </button>
        </div>
      )}

      {/* Retention Gift Banner */}
      {requiresGift && (
        <div className={`p-3 rounded-xl border-2 flex items-center justify-between shadow-sm ${
          order.giftConfirmed 
            ? 'bg-emerald-50 border-emerald-400' 
            : order.retentionGift === 'card_discount_15'
              ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-500/20'
              : 'bg-orange-100 border-orange-500 ring-2 ring-orange-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {order.retentionGift === 'card_discount_15' ? '🎁' : order.retentionGift === 'branded_spoon' ? '🥄' : '📋'}
            </div>
            <div>
              <div className={`font-black text-sm ${order.giftConfirmed ? 'text-emerald-800' : 'text-slate-900'}`}>
                {order.customerOrderCount}° ORDINE: 
                {order.retentionGift === 'card_discount_15' ? ' Inserire Cartolina Sconto -15% (Slot #2)' : 
                 order.retentionGift === 'branded_spoon' ? ' Inserire Cucchiaio Dosatore NORSAN!' : 
                 ' Inserire Volantino Re-test Omegametrix (Slot #3)'}
              </div>
            </div>
          </div>
          <button
            onClick={onToggleGift}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all active:scale-95 ${
              order.giftConfirmed
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
              order.giftConfirmed ? 'border-white bg-emerald-500' : 'border-slate-300 bg-white'
            }`}>
              {order.giftConfirmed && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span>Ho inserito l'omaggio nel pacco</span>
          </button>
        </div>
      )}

      {/* SellyErp Loyalty Badge — shown for INT/ORDVE orders with customerOrderCount */}
      {(order.source === 'SellyErp INT' || order.source === 'SellyErp ORDVE') && order.customerOrderCount > 1 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 p-3 rounded-r flex items-center gap-3 shadow-sm">
          <span className="text-xl">⭐</span>
          <div>
            <div className="font-black text-sm">Cliente Fedele — {order.customerOrderCount}° ordine</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">
              Progressivo ordine: {order.sellyErpOrderId || order.orderNumber}
              {order.customerOrderCount >= 4 && ' · Valutare sample bonus'}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Visual Product Cards with High Contrast 2-Meter Shelf Coordinates */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {order.items.map((item, index) => {
            const isCompleted = item.quantityScanned >= item.quantityRequired;
            const isPartial = item.quantityScanned > 0 && !isCompleted;
            const progressPercent = Math.min(100, Math.round((item.quantityScanned / item.quantityRequired) * 100));

            let cardClass = 'bg-white border-2 border-slate-300 shadow-sm hover:border-slate-400';
            const isStation1 = stationConfigId === 'STATION_01';

            // ── Reachability direction (mirrors on station switch) ──────────
            let reachabilityText = '';
            if (item.product.isFastBuffer) {
              reachabilityText = ''; // No arrow — it's on the table
            } else if (item.product.brand === 'NORSAN') {
              reachabilityText = isStation1 ? '⬅️ ZONA SINISTRA (Scaffale NORSAN)' : '➡️ ZONA DESTRA (Scaffale NORSAN)';
            } else if (item.product.brand === 'ZREEN') {
              reachabilityText = isStation1 ? '➡️ ZONA DESTRA (Scaffale ZREEN)' : '⬅️ ZONA SINISTRA (Scaffale ZREEN)';
            }

            // ── Color badge per brand/category ─────────────────────────────
            let badgeShelfClass = 'bg-amber-100 text-amber-950 border-amber-400';
            if (item.product.brand === 'ZREEN') {
              if (item.product.colorCategory === 'sleep_calm') badgeShelfClass = 'bg-blue-100 text-blue-900 border-blue-400';
              else if (item.product.colorCategory === 'gut_detox') badgeShelfClass = 'bg-green-100 text-green-900 border-green-400';
              else if (item.product.colorCategory === 'amino_energy') badgeShelfClass = 'bg-orange-100 text-orange-900 border-orange-400';
              else badgeShelfClass = 'bg-slate-100 text-slate-900 border-slate-400';
            } else {
              if (item.product.rackSide === 'D') badgeShelfClass = 'bg-cyan-100 text-cyan-950 border-cyan-400';
            }

            if (isCompleted) {
              cardClass = 'bg-emerald-50/80 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20';
            } else if (isPartial) {
              cardClass = 'bg-amber-50/80 border-2 border-amber-500 shadow-md ring-2 ring-amber-500/20';
            }

            const remainingQty = item.quantityRequired - item.quantityScanned;
            const isBulkMultiple = remainingQty >= 6;

            // ── Pick-to-Light virtual emulator glow ─────────────────────────
            const hasP2L = !!(item.product.p2lTier && item.product.p2lLedIndex != null);
            const p2lGlowClass = hasP2L && !isCompleted
              ? 'after:absolute after:inset-0 after:rounded-3xl after:pointer-events-none after:animate-p2l-pulse'
              : '';

            return (
              <div
                key={item.product.id}
                className={`rounded-3xl p-4.5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${cardClass} ${p2lGlowClass}`}
              >
                {/* Pick-to-Light LED Badge */}
                {hasP2L && !isCompleted && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white inline-block" />
                    LED {item.product.p2lTier}-{item.product.p2lLedIndex}
                  </div>
                )}

                {/* Top: Shelf Badge & Item Status */}
                <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-200">
                  <div className="text-xs font-black uppercase text-slate-500 tracking-wide">
                    {item.product.isFastBuffer
                      ? <span className="text-violet-700">📍 TAVOLO — Scatola aperta sul tavolo</span>
                      : reachabilityText
                    }
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {/* Huge Shelf Coordinate Pill — glow if P2L active */}
                    <div className={`px-3.5 py-1.5 rounded-xl border-2 font-mono font-black text-xl flex items-center gap-2 shadow-xs ${badgeShelfClass} ${hasP2L && !isCompleted ? 'ring-2 ring-emerald-400 shadow-emerald-300 shadow-md' : ''}`}>
                      <MapPin className="w-5 h-5 text-slate-800" />
                      <span>{item.product.isFastBuffer ? '📍 TAVOLO' : (item.product.shelfCoordinate || item.product.shelfLocation)}</span>
                    </div>

                  <div className="flex items-center gap-1.5">
                    {/* Brand Pill */}
                    {item.product.brand === 'ZREEN' && (
                      <span className="text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg">
                        ZREEN
                      </span>
                    )}

                    {isCompleted ? (
                      <span className="text-xs bg-emerald-600 text-white font-black px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-xs">
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>COMPLETO</span>
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-300">
                        #{index + 1}
                      </span>
                    )}
                  </div>
                </div>
                </div>

                {/* Center: Large Image (112px) & Product Details */}
                <div className="my-3.5 flex items-start gap-4">
                  {/* High Quality Large Product Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-28 h-28 object-cover rounded-2xl border-2 border-slate-300 bg-white shadow-sm"
                    />
                    {item.product.fragile && (
                      <div
                        className="absolute -top-2 -right-2 p-1.5 bg-amber-500 text-slate-950 rounded-full shadow-md"
                        title="Flacone in Vetro - Proteggere con pluriball"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Title & EAN */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-slate-900 leading-snug line-clamp-2">
                      {item.product.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5 line-clamp-1">
                      {item.product.italianName}
                    </p>

                    <div className="mt-2 flex items-center gap-1 text-xs font-mono text-slate-600">
                      <Barcode className="w-4 h-4 text-slate-500" />
                      <span>EAN: <strong className="text-slate-900">{item.product.ean}</strong></span>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {item.product.fragile && (
                        <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          Vetro â€¢ Pluriball
                        </span>
                      )}

                      {/* 1-Click 5S Kanban Replenishment Call */}
                      <button
                        type="button"
                        onClick={() => handleTriggerKanbanRefill(item.product.name, item.product.shelfLocation)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition active:scale-95 flex items-center gap-1 ${
                          kanbanAlertItem === item.product.shelfLocation
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border-slate-300'
                        }`}
                        title="Invia segnale Kanban di rifornimento per questa posizione senza allontanarsi dalla postazione"
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{kanbanAlertItem === item.product.shelfLocation ? 'âœ“ Kanban Inviato' : 'Chiama Scorta (Kanban)'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom: Quantity Counter, Progress Bar & Skan Button */}
                <div className="pt-2.5 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase font-black text-slate-500">QuantitÃ :</span>
                    <div className="font-mono text-2xl font-black">
                      <span className={isCompleted ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-slate-900'}>
                        {item.quantityScanned}
                      </span>
                      <span className="text-slate-400 font-normal text-lg"> / {item.quantityRequired} PZ</span>
                    </div>
                  </div>

                  {/* Progress bar line */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-600' : isPartial ? 'bg-amber-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Quick Scan & Master Box Fast-Scan Buttons */}
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <div className="w-full text-center py-2 bg-emerald-100 text-emerald-900 font-black text-xs rounded-xl border border-emerald-300">
                        âœ“ Verificato con Scanner
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onSimulateScan(item.product.ean)}
                          className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Scansiona (+1)</span>
                        </button>

                        {/* Lean Master Carton (+6 PZ) for Bulk B2B Orders */}
                        {isBulkMultiple && (
                          <button
                            onClick={() => onSimulateScan(item.product.ean, 6)}
                            className="py-2.5 px-3 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs rounded-xl border border-amber-300 transition active:scale-95 flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Scansione Cartone Master (+6 pz in 1 colpo) per eliminare movimenti inutili (Lean Motion Elimination)"
                          >
                            <Boxes className="w-4 h-4 text-amber-800" />
                            <span>Cartone (+6)</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Sticky Action Footer */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Order completion status text & Poka-Yoke shield */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
            isOrderFullyReady
              ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
              : 'bg-slate-100 border-slate-300 text-slate-600'
          }`}>
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
              <span>Stato Imballaggio Ordine</span>
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-black font-mono">
                100% POKA-YOKE
              </span>
            </div>
            <div className="text-base font-black text-slate-900">
              {isOrderFullyReady ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-700">Tutti i {totalItemsRequired} prodotti scansionati! Pronto per la spedizione.</span>
                  {requiredFlyer && (
                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      ðŸ’¡ Ricorda: {requiredFlyer.title} [{requiredFlyer.shelfLocation}]
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-amber-800">Mancano {totalItemsRequired - totalItemsScanned} prodotti da scansionare</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions: Report issue & Giant Print DHL button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={onOpenIssueModal}
            className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-rose-50 active:scale-95 text-rose-700 hover:text-rose-900 text-xs font-bold border border-slate-300 hover:border-rose-300 transition flex items-center gap-1.5 shadow-xs"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Segnala Anomalia</span>
          </button>

          {isOrderFullyReady ? (
            <button
              onClick={onOpenLabelModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-base font-black tracking-wide shadow-lg transition-all animate-pulse cursor-pointer"
            >
              <Printer className="w-5 h-5 text-white" />
              <span>STAMPA ETICHETTA {order.courier.toUpperCase()}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              disabled
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold border border-slate-300 cursor-not-allowed"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>STAMPA BLOCCATA ({!isProductsFullyScanned ? `${totalItemsScanned}/${totalItemsRequired} SCANSIONATI` : 'VOLANTINI MANCANTI'})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
