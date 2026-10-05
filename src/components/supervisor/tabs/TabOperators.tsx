import React, { useState, useRef } from "react";
import {
  Users,
  Sparkles,
  UserPlus,
  Printer,
  Edit3,
  Trash2,
  X,
  Upload,
  Check,
} from "lucide-react";
import { Operator } from "../../../types/wms";

interface TabOperatorsProps {
  operators: Operator[];
  onAddOperator?: (operator: Operator) => void;
  onUpdateOperator?: (operator: Operator) => void;
  onDeleteOperator?: (operatorId: string) => void;
  onSimulateScan?: (barcode: string) => void;
}

export const TabOperators: React.FC<TabOperatorsProps> = ({
  operators,
  onAddOperator,
  onUpdateOperator,
  onDeleteOperator,
  onSimulateScan,
}) => {
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<Operator | null>(
    null,
  );
  const [badgeOperator, setBadgeOperator] = useState<Operator | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const AVATAR_PRESETS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
  ];

  // Form state for adding new operator
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState<
    "packer" | "team_lead" | "supervisor"
  >("packer");
  const [newOpStationId, setNewOpStationId] = useState(
    "Tutte le postazioni (Rotazione)",
  );
  const [newOpShift, setNewOpShift] = useState("Mattina (07:00 - 15:30)");
  const [newOpAvatar, setNewOpAvatar] = useState(AVATAR_PRESETS[0]);

  // Form state for editing operator / lead
  const [editOpName, setEditOpName] = useState("");
  const [editOpRole, setEditOpRole] = useState<
    "packer" | "team_lead" | "supervisor"
  >("packer");
  const [editOpCode, setEditOpCode] = useState("");
  const [editOpStationId, setEditOpStationId] = useState("");
  const [editOpShift, setEditOpShift] = useState("");
  const [editOpAvatar, setEditOpAvatar] = useState("");

  const handleOpenEdit = (op: Operator) => {
    setEditingOperator(op);
    setEditOpName(op.name);
    setEditOpRole(op.role);
    setEditOpCode(op.operatorCode || "");
    setEditOpStationId(op.stationId || "");
    setEditOpShift(op.shift || "");
    setEditOpAvatar(op.avatarUrl || "");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOperator && onUpdateOperator) {
      onUpdateOperator({
        ...editingOperator,
        name: editOpName,
        role: editOpRole,
        operatorCode: editOpCode,
        stationId: editOpStationId,
        shift: editOpShift,
        avatarUrl: editOpAvatar,
      });
    }
    setEditingOperator(null);
  };

  const handleDeleteOperatorClick = (opId: string) => {
    const op = operators.find((o) => o.id === opId);
    if (op) {
      setOperatorToDelete(op);
    }
  };

  const handleSaveNewOperator = () => {
    if (!newOpName.trim()) return;
    const newOp: Operator = {
      id: `OP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      name: newOpName,
      role: newOpRole,
      avatarUrl: newOpAvatar,
      stationId: newOpStationId,
      shift: newOpShift,
      operatorCode:
        "OP-" + Math.random().toString(36).substr(2, 4).toUpperCase(),
      packedToday: 0,
      accuracy: 100,
      uph: 0,
      errorsPrevented: 0,
    };
    if (onAddOperator) onAddOperator(newOp);
    setIsAddOperatorOpen(false);
    setNewOpName("");
    setNewOpRole("packer");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewOpAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditPhotoFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditOpAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-xs">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Gestione Personale & Stampa Badge Barcode</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggiungi nuovi addetti all'imballaggio, assegna codici
              identificativi (OP-XXX) e stampa il badge per il login istantaneo
              con lettore barcode.
            </p>
          </div>

          <button
            onClick={() => setIsAddOperatorOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Aggiungi Nuovo Operatore</span>
          </button>
        </div>

        {/* Operators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {operators.map((op) => (
            <div
              key={op.id}
              className="bg-white border-2 border-slate-300 rounded-3xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-400 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={op.avatarUrl}
                      alt={op.name}
                      className={`w-12 h-12 rounded-full object-cover border-2 shadow-xs flex-shrink-0 ${
                        op.role === "team_lead"
                          ? "border-purple-600"
                          : "border-blue-600"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-slate-900 truncate">
                          {op.name}
                        </h4>
                        {op.role === "team_lead" && (
                          <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300 px-1.5 py-0.5 rounded flex-shrink-0">
                            Lead
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono font-bold mt-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            op.role === "team_lead"
                              ? "bg-purple-50 text-purple-900 border-purple-200"
                              : "bg-blue-50 text-blue-900 border-blue-200"
                          }`}
                        >
                          {op.operatorCode}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500 truncate">
                          {op.stationId}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {op.shift}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleOpenEdit(op)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-slate-300 hover:border-blue-300 transition active:scale-95 cursor-pointer"
                      title="Modifica dati o ruolo operatore / lead"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setOperatorToDelete(op)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-300 hover:border-rose-300 transition active:scale-95 cursor-pointer"
                      title="Elimina profilo dal sistema"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-3 text-center">
                  <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">
                      Colli
                    </div>
                    <div className="text-base font-black font-mono text-emerald-700">
                      {op.packedToday}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">
                      UPH
                    </div>
                    <div className="text-base font-black font-mono text-amber-700">
                      {op.uph}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">
                      Precisione
                    </div>
                    <div className="text-base font-black font-mono text-cyan-800">
                      {op.accuracy}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => setBadgeOperator(op)}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1 border border-slate-300 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa Badge</span>
                </button>

                <button
                  onClick={() => {
                    if (onSimulateScan) onSimulateScan(op.operatorCode);
                  }}
                  className="py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs rounded-xl transition active:scale-95 flex items-center gap-1 border border-blue-300 cursor-pointer"
                  title={`Simula Scansione Barcode [${op.operatorCode}] per login`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Login</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Modal 1: Add New Operator */}
      {isAddOperatorOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border-2 border-slate-300 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Nuovo Operatore / Addetto Magazzino
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assegna un nuovo badge per il login barcode rapido
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOperatorOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewOperator} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Nome & Cognome
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Giovanni Bianchi"
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Ruolo
                  </label>
                  <select
                    value={newOpRole}
                    onChange={(e) => setNewOpRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="packer">Addetto Imballaggio</option>
                    <option value="team_lead">Team Lead / Capoturno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Postazione Assegnata
                  </label>
                  <select
                    value={newOpStationId}
                    onChange={(e) => setNewOpStationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="Tutte le postazioni (Rotazione)">
                      Tutte le postazioni (Rotazione libera)
                    </option>
                    <option value="ST-01">Postazione #01</option>
                    <option value="ST-02">Postazione #02</option>
                    <option value="ST-03">Postazione #03</option>
                    <option value="ST-04">
                      Postazione #04 (Nuova postazione)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Turno di Lavoro
                </label>
                <input
                  type="text"
                  value={newOpShift}
                  onChange={(e) => setNewOpShift(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              {/* Photo & Avatar Selection Block */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Foto / Badge Avatar
                </label>

                {/* Current Photo Preview + File Upload Button */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-3">
                  <img
                    src={newOpAvatar}
                    alt="Preview"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-600 shadow-sm flex-shrink-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Foto Operatore Selezionata
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Carica una foto reale dal computer oppure scegli dalla
                      galleria in basso.
                    </p>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-300 transition active:scale-95 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>📸 Carica Foto da File</span>
                    </button>
                  </div>
                </div>

                {/* Avatar Presets Gallery */}
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    Oppure scegli un avatar dalla galleria:
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((presetUrl, idx) => {
                      const isSelected = newOpAvatar === presetUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewOpAvatar(presetUrl)}
                          className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition active:scale-90 cursor-pointer ${
                            isSelected
                              ? "border-blue-600 ring-2 ring-blue-500/40 shadow-sm"
                              : "border-slate-300 hover:border-slate-400 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={presetUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOperatorOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer"
                >
                  Crea & Genera Badge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Printable Physical Badge Modal */}
      {badgeOperator && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-slate-400 animate-in fade-in zoom-in duration-150 flex flex-col items-center">
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Badge Operatore NORSAN
              </span>
              <button
                onClick={() => setBadgeOperator(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable ID Card (Standard CR80 Lanyard Card Layout) */}
            <div className="w-full my-4 bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-xl border-2 border-slate-700 relative overflow-hidden flex flex-col items-center text-center">
              {/* Top Lanyard Hole Visual */}
              <div className="w-12 h-2.5 bg-slate-800 border border-slate-600 rounded-full mb-3 shadow-inner" />

              {/* Company Logo Header */}
              <div className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-black">
                NORSAN • ZREEN LOGISTICS
              </div>
              <div className="text-[9px] text-slate-400 uppercase font-semibold">
                Hub di Spedizione • Bolzano (BZ)
              </div>

              {/* Photo & Role */}
              <div className="my-3 relative">
                <img
                  src={badgeOperator.avatarUrl}
                  alt={badgeOperator.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-cyan-400 shadow-md"
                />
              </div>

              <h4 className="text-base font-black text-white">
                {badgeOperator.name}
              </h4>
              <div className="text-xs text-cyan-300 font-bold uppercase mt-0.5">
                {badgeOperator.role === "team_lead"
                  ? "Team Lead / Supervisore"
                  : "Addetto Imballaggio (Packer)"}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {badgeOperator.shift}
              </div>

              {/* High Resolution Code 128 Barcode Simulation */}
              <div className="w-full mt-4 bg-white text-slate-950 rounded-xl p-3 shadow-inner flex flex-col items-center">
                {/* SVG Barcode Bars */}
                <div className="w-full h-12 flex items-center justify-between px-1">
                  {[
                    4, 2, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 1, 4, 2, 6, 3, 1, 5,
                    2, 4, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 1, 4, 2,
                  ].map((w, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{ width: `${w * 1.5}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-sm font-black tracking-widest text-slate-900 mt-1">
                  *{badgeOperator.operatorCode}*
                </span>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="w-full flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-300" />
                <span>Stampa Badge</span>
              </button>

              <button
                onClick={() => {
                  if (onSimulateScan)
                    onSimulateScan(badgeOperator.operatorCode);
                  setBadgeOperator(null);
                }}
                className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 font-black text-xs rounded-xl border border-blue-300 transition active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Testa subito la scansione del badge"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Test Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Operator / Team Lead Profile Modal */}
      {editingOperator && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border-2 border-slate-300 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    editOpRole === "team_lead"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Modifica{" "}
                    {editOpRole === "team_lead" ? "Team Lead" : "Operatore"} (
                    {editingOperator.operatorCode})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aggiorna anagrafica, ruolo, postazione o foto profilo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingOperator(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Nome & Cognome
                  </label>
                  <input
                    type="text"
                    required
                    value={editOpName}
                    onChange={(e) => setEditOpName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Codice Badge
                  </label>
                  <input
                    type="text"
                    required
                    value={editOpCode}
                    onChange={(e) => setEditOpCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Ruolo & Privilegi
                  </label>
                  <select
                    value={editOpRole}
                    onChange={(e) => setEditOpRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="packer">Addetto Imballaggio (Packer)</option>
                    <option value="team_lead">Team Lead / Supervisore</option>
                    <option value="supervisor">Supervisore Generale</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Postazione Assegnata
                  </label>
                  <select
                    value={editOpStationId}
                    onChange={(e) => setEditOpStationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="Tutte le postazioni (Rotazione)">
                      Tutte le postazioni (Rotazione libera)
                    </option>
                    <option value="Coordinamento Reparto Spedizioni">
                      Coordinamento Reparto Spedizioni
                    </option>
                    <option value="SUP-HUB">
                      SUP-HUB (Ufficio Supervisore)
                    </option>
                    <option value="ST-01">Postazione #01</option>
                    <option value="ST-02">Postazione #02</option>
                    <option value="ST-03">Postazione #03</option>
                    <option value="ST-04">Postazione #04 (Nuova)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Turno di Lavoro
                </label>
                <input
                  type="text"
                  value={editOpShift}
                  onChange={(e) => setEditOpShift(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              {/* Photo & Avatar Selection Block */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Foto / Badge Avatar
                </label>

                {/* Current Photo Preview + File Upload Button */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-3">
                  <img
                    src={editOpAvatar}
                    alt="Preview"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-600 shadow-sm flex-shrink-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Foto Profilo
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Carica una nuova foto dal computer o scegli dalla
                      galleria.
                    </p>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={editFileInputRef}
                      onChange={handleEditPhotoFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-300 transition active:scale-95 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-purple-600" />
                      <span>📸 Carica Nuova Foto</span>
                    </button>
                  </div>
                </div>

                {/* Avatar Presets Gallery */}
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    Oppure seleziona un avatar:
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((presetUrl, idx) => {
                      const isSelected = editOpAvatar === presetUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditOpAvatar(presetUrl)}
                          className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition active:scale-90 cursor-pointer ${
                            isSelected
                              ? "border-purple-600 ring-2 ring-purple-500/40 shadow-sm"
                              : "border-slate-300 hover:border-slate-400 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={presetUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteOperatorClick(editingOperator.id)}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Elimina Profilo</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingOperator(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer"
                  >
                    Salva Modifiche
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Confirmation Modal */}
      {operatorToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-rose-300 animate-in fade-in zoom-in duration-150 flex flex-col items-center text-center">
            <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl mb-3">
              <Trash2 className="w-8 h-8" />
            </div>

            <h3 className="text-base font-black text-slate-900">
              Eliminare {operatorToDelete.name}?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Il badge{" "}
              <strong className="font-mono text-slate-800">
                [{operatorToDelete.operatorCode}]
              </strong>{" "}
              verrà  revocato e l'operatore non potrà  più accedere alle
              postazioni di magazzino.
            </p>

            <div className="w-full flex items-center gap-2 mt-5">
              <button
                onClick={() => setOperatorToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (onDeleteOperator) onDeleteOperator(operatorToDelete.id);
                  setOperatorToDelete(null);
                  setEditingOperator(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sì, Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
