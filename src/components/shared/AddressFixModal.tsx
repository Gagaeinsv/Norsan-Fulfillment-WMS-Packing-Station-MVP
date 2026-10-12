import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Save,
  ArrowRight,
  Info,
} from "lucide-react";
import { Order } from "../../types/wms";
import {
  parseItalianAddress,
  parseFullAddressBlock,
} from "../../services/italianAddressParser";

interface AddressFixModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveAddress: (
    orderId: string,
    updatedFields: {
      customerName: string;
      customerAddress: string;
      customerCity: string;
      customerZip: string;
      customerProvince: string;
      customerCountry: string;
      addressDetails: {
        street: string;
        houseNumber: string;
        addressAddition: string;
        status: "valid" | "warning" | "error";
      };
    }
  ) => void;
}

export const AddressFixModal: React.FC<AddressFixModalProps> = ({
  order,
  isOpen,
  onClose,
  onSaveAddress,
}) => {
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [addressAddition, setAddressAddition] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("IT");
  const [customerName, setCustomerName] = useState("");
  const [rawAddressText, setRawAddressText] = useState("");

  useEffect(() => {
    if (order) {
      setCustomerName(order.customerName || "");
      setZip(order.customerZip || "");
      setCity(order.customerCity || "");
      setProvince(order.customerProvince || "");
      setCountry(order.customerCountry || "IT");

      // Build or extract raw address
      const fullRaw =
        order.addressDetails?.rawInput ||
        order.customerAddress ||
        "";
      setRawAddressText(fullRaw);

      if (order.addressDetails) {
        setStreet(order.addressDetails.street || "");
        setHouseNumber(order.addressDetails.houseNumber || "");
        setAddressAddition(order.addressDetails.addressAddition || "");
      } else {
        // Auto-run smart parser on open
        const parsed = parseItalianAddress(order.customerAddress);
        setStreet(parsed.street);
        setHouseNumber(parsed.houseNumber);
        setAddressAddition(parsed.addressAddition);
      }
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  // Auto-normalize trigger
  const handleAutoNormalize = () => {
    // If user pasted a full multi-line block
    if (rawAddressText.includes("\n") && (rawAddressText.includes("Pontassieve") || /\d{5}/.test(rawAddressText))) {
      const fullBlock = parseFullAddressBlock(rawAddressText);
      if (fullBlock) {
        if (fullBlock.customerName) setCustomerName(fullBlock.customerName);
        if (fullBlock.street) setStreet(fullBlock.street);
        if (fullBlock.houseNumber) setHouseNumber(fullBlock.houseNumber);
        if (fullBlock.addressAddition) setAddressAddition(fullBlock.addressAddition);
        if (fullBlock.zip) setZip(fullBlock.zip);
        if (fullBlock.city) setCity(fullBlock.city);
        if (fullBlock.province) setProvince(fullBlock.province);
        if (fullBlock.country) setCountry(fullBlock.country);
        return;
      }
    }

    const parsed = parseItalianAddress(rawAddressText || order.customerAddress);
    setStreet(parsed.street);
    setHouseNumber(parsed.houseNumber);
    setAddressAddition(parsed.addressAddition);
  };

  const isComplete = Boolean(street && houseNumber && zip && city);

  const handleSave = () => {
    const fullStreetLine = [
      street,
      houseNumber,
      addressAddition ? `(${addressAddition})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const finalStatus: "valid" | "warning" | "error" = isComplete
      ? "valid"
      : !houseNumber
      ? "warning"
      : "error";

    onSaveAddress(order.id, {
      customerName,
      customerAddress: fullStreetLine,
      customerCity: city,
      customerZip: zip,
      customerProvince: province,
      customerCountry: country,
      addressDetails: {
        street,
        houseNumber,
        addressAddition,
        status: finalStatus,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-white border-2 border-slate-300 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Risoluzione Indirizzo di Spedizione (DHL)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                  Smart Italian Parser
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ordine <strong className="font-mono text-slate-800">{order.orderNumber}</strong> • {order.customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-slate-100/60">
          {/* Imported raw block (Matching the photo's 'Importierte Adresse') */}
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Indirizzo Importato Grezzo (Importierte Adresse)
              </span>
              <button
                type="button"
                onClick={handleAutoNormalize}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition active:scale-95 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Separa (1-Click)</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 space-y-0.5 select-text">
              <div className="font-bold text-slate-900">{customerName || order.customerName}</div>
              <div className="text-blue-900 font-semibold">{rawAddressText || order.customerAddress}</div>
              <div className="text-slate-600">
                {zip || order.customerZip} {city || order.customerCity}
              </div>
              <div className="text-slate-600">
                🇮🇹 {province || order.customerProvince}, {country || order.customerCountry}
              </div>
            </div>

            {/* Interactive smart chips */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-semibold">Tocca per inserire:</span>
              {rawAddressText
                .split(/[\r\n,]+/)
                .map((seg) => seg.trim())
                .filter(Boolean)
                .map((seg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (/^\d+[a-zA-Z]?$/.test(seg) || seg.toLowerCase() === "snc") {
                        setHouseNumber(seg);
                      } else if (/piano|scala|int/i.test(seg)) {
                        setAddressAddition(seg);
                      } else {
                        setStreet(seg);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-300 text-slate-700 font-mono transition"
                  >
                    {seg}
                  </button>
                ))}
            </div>
          </div>

          {/* Form fields (Straße, Hausnummer, Adresszusatz) */}
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>Campi Strutturati per Etichetta DHL (Lieferadresse)</span>
              {isComplete ? (
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Pronto per la stampa
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Campi obbligatori mancanti
                </span>
              )}
            </div>

            {/* Street + House Number grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nome Via (Straße) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Es. Via Giuseppe Di Vittorio"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition ${
                    !street
                      ? "border-red-400 bg-red-50/30 focus:border-red-500"
                      : "border-slate-300 bg-white focus:border-blue-500"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Civico (Nr.) <span className="text-red-500">*</span></span>
                  <button
                    type="button"
                    onClick={() => setHouseNumber("SNC")}
                    className="text-[10px] text-blue-600 hover:underline lowercase font-mono"
                  >
                    +SNC
                  </button>
                </label>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="Es. 22 o SNC"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold transition ${
                    !houseNumber
                      ? "border-amber-400 bg-amber-50/30 focus:border-amber-500"
                      : "border-slate-300 bg-white focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Address Addition (Piano, Scala, Citofono) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Piano / Scala / Note Consegna (Adresszusatz)
              </label>
              <input
                type="text"
                value={addressAddition}
                onChange={(e) => setAddressAddition(e.target.value)}
                placeholder="Es. 2 piano, Scala B, Citofono Marchini"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:border-blue-500 transition"
              />
            </div>

            {/* ZIP, City, Province grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  CAP (PLZ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="50065"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Città (Stadt) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Pontassieve"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Provincia (Prov)
                </label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="FI"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition active:scale-95 shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>Salva & Valida per Spedizione DHL</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
