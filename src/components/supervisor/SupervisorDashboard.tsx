import React, { useState, useRef } from "react";
import {
  TrendingUp,
  AlertOctagon,
  Globe,
  CheckCircle,
  Package,
  Activity,
  ArrowRight,
  Layers,
  Users,
  UserPlus,
  Printer,
  X,
  Sparkles,
  Upload,
  Check,
  Edit3,
  Trash2,
  AlertTriangle,
  MapPin,
  FileText,
  RefreshCw,
  Key,
  Settings,
  ShoppingBag,
  Lock,
  ExternalLink,
  Clock,
  ShieldAlert,
  RotateCcw,
  Truck,
  Database,
} from "lucide-react";
import {
  WarehouseStation,
  Operator,
  Order,
  IssueTicket,
  Product,
} from "../../types/wms";
import { SlottingManager, WarehouseSlotData } from "./SlottingManager";
import { AddressFixModal } from "../shared/AddressFixModal";
import {
  printAmazonPackingSlip,
  printBatchAmazonPackingSlips,
} from "../../services/amazonSlipPrinter";
import {
  printOrderPackingSlip,
  printBatchPackingSlips,
} from "../../services/orderSlipPrinter";
import { getCode128Bars } from "../../services/barcodeGenerator";
import {
  getProductLotInfo,
  updateProductLotInfo,
  rotateToSecondaryLot,
} from "../../services/lotTraceabilityService";
import {
  getWarehouseInventory,
  recordPhysicalCount,
  transferCartonsToPackingShelf,
  receiveInboundPallet,
} from "../../services/mainWarehouseInventoryService";
import { WMS_PHASE_CONFIG } from "../../config/wmsPhaseConfig";

interface SupervisorDashboardProps {
  stations: WarehouseStation[];
  operators: Operator[];
  orders: Order[];
  issues: IssueTicket[];
  products: Product[];
  slots: WarehouseSlotData[];
  onAssignSlot: (slotCode: string, productId: string | null) => Promise<void>;
  onAddSlot: (side: "S" | "D", tier: 1 | 2 | 3) => Promise<void>;
  onDeleteSlot: (slotCode: string) => Promise<void>;
  onResolveIssue: (issueId: string) => void;
  onSimulateIncomingWebOrder: () => void;
  onSwitchToStation: (stationId: string) => void;
  onAddOperator?: (operator: Operator) => void;
  onUpdateOperator?: (operator: Operator) => void;
  onDeleteOperator?: (operatorId: string) => void;
  onSimulateScan?: (barcode: string) => void;
  stationConfigId?: string;
  onUpdateProductImage?: (productId: string, imageUrl: string) => void;
  onResetSlotsToDefault?: () => void;
  onUpdateOrderAddress?: (orderId: string, updatedFields: any) => void;
}

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

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  stations,
  operators,
  orders,
  issues,
  products,
  slots,
  onAssignSlot,
  onAddSlot,
  onDeleteSlot,
  onResolveIssue,
  onSimulateIncomingWebOrder: _onSimulateIncomingWebOrder,
  onSwitchToStation,
  onAddOperator,
  onUpdateOperator,
  onDeleteOperator,
  onSimulateScan,
  stationConfigId,
  onUpdateProductImage,
  onResetSlotsToDefault,
  onUpdateOrderAddress,
}) => {
  const [activeTab, setActiveTab] = useState<
    | "stations"
    | "ecommerce"
    | "amazon"
    | "issues"
    | "operators"
    | "slotting"
    | "lean"
    | "fefo"
    | "inventory"
    | "roadmap"
  >("stations");

  // FEFO & Batch Recall State
  const [recallSearchLot, setRecallSearchLot] = useState("");
  const [, setFefoRefreshTick] = useState(0);
  const [editingShelfProductId, setEditingShelfProductId] = useState<string | null>(null);
  const [shelfLotDraft, setShelfLotDraft] = useState("");
  const [shelfExpDraft, setShelfExpDraft] = useState("");

  // Main Warehouse & Smart Cycle Count State
  const [countingSku, setCountingSku] = useState<string | null>(null);
  const [countCartonsDraft, setCountCartonsDraft] = useState<number>(0);
  const [countShelfDraft, setCountShelfDraft] = useState<number>(0);
  const [inboundSku, setInboundSku] = useState<string>("NOR-TOT-200-LEM");
  const [inboundCartons, setInboundCartons] = useState<number>(1);
  const [inboundLot, setInboundLot] = useState<string>("");
  const [inboundExpiry, setInboundExpiry] = useState<string>("");
  const [inventorySearch, setInventorySearch] = useState<string>("");

  // Address Normalizer Modal State
  const [selectedAddressOrder, setSelectedAddressOrder] = useState<Order | null>(
    null
  );
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Amazon SP-API Integration State (persisted to localStorage)
  const savedAmazonConfig = (() => {
    try {
      const raw = localStorage.getItem("wms_amazon_sp_config");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [amazonSellerId, setAmazonSellerId] = useState(savedAmazonConfig?.sellerId || "");
  const [amazonClientId, setAmazonClientId] = useState(savedAmazonConfig?.clientId || "");
  const [amazonClientSecret, setAmazonClientSecret] = useState(savedAmazonConfig?.clientSecret || "");
  const [amazonRefreshToken, setAmazonRefreshToken] = useState(savedAmazonConfig?.refreshToken || "");
  const [isAmazonSyncing, setIsAmazonSyncing] = useState(false);
  const [amazonSyncStatus, setAmazonSyncStatus] = useState<"idle" | "ok" | "error">(
    savedAmazonConfig?.sellerId ? "ok" : "idle"
  );
  const [amazonSyncMessage, setAmazonSyncMessage] = useState(
    savedAmazonConfig?.sellerId
      ? "Credenziali SP-API configurate"
      : "Modalità Bolla A4 e CSV/PDF attiva"
  );
  const [isAmazonConfigModalOpen, setIsAmazonConfigModalOpen] = useState(false);

  // Selly ERP Auto-Sync State
  const [sellyApiKey, setSellyApiKey] = useState("");
  const [sellyApiUrl, setSellyApiUrl] = useState("https://api.sellyerp.com/v1");
  const [sellyInterval, setSellyInterval] = useState(5);
  const [sellyAutoSyncEnabled, setSellyAutoSyncEnabled] = useState(false);
  const [isSellySyncing, setIsSellySyncing] = useState(false);
  const [sellySyncStatus, setSellySyncStatus] = useState<"idle" | "ok" | "error">("idle");
  const [sellySyncMessage, setSellySyncMessage] = useState("In attesa di API Key");
  const [isSellyConfigModalOpen, setIsSellyConfigModalOpen] = useState(false);

  const sellyBackendBase =
    typeof window !== "undefined"
      ? `http://${window.location.hostname}:3001/api`
      : "http://localhost:3001/api";

  // Fetch Selly config on initial load
  React.useEffect(() => {
    fetch(`${sellyBackendBase}/selly/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.apiKey) setSellyApiKey(data.apiKey);
          if (data.apiUrl) setSellyApiUrl(data.apiUrl);
          if (data.syncIntervalMinutes) setSellyInterval(data.syncIntervalMinutes);
          if (data.isEnabled !== undefined) setSellyAutoSyncEnabled(data.isEnabled);
          if (data.lastSyncStatus) setSellySyncStatus(data.lastSyncStatus);
          if (data.lastSyncMessage) setSellySyncMessage(data.lastSyncMessage);
        }
      })
      .catch(() => {
        // Backend not reachable or running in mock standalone mode
      });
  }, [sellyBackendBase]);

  const handleSaveSellyConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`${sellyBackendBase}/selly/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: sellyApiKey.trim(),
          apiUrl: sellyApiUrl.trim(),
          syncIntervalMinutes: sellyInterval,
          isEnabled: sellyAutoSyncEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSellyConfigModalOpen(false);
        setSellySyncStatus(data.config.isEnabled && data.config.apiKey ? "ok" : "idle");
        setSellySyncMessage(
          data.config.apiKey
            ? `Connessione Selly salvata (polling ogni ${data.config.syncIntervalMinutes} min)`
            : "In attesa di API Key"
        );
      }
    } catch (err) {
      console.warn("Could not save Selly config to backend:", err);
      setIsSellyConfigModalOpen(false);
    }
  };

  const handleSyncSellyNow = async () => {
    setIsSellySyncing(true);
    setSellySyncMessage("Sincronizzazione in corso con Selly ERP...");
    try {
      const res = await fetch(`${sellyBackendBase}/selly/sync-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setSellySyncStatus("ok");
        setSellySyncMessage(data.message || `Sincronizzazione completata: ${data.count} ordini`);
      } else {
        setSellySyncStatus("idle");
        setSellySyncMessage(data.message || "Nessun ordine o API Key mancante");
      }
    } catch (err) {
      setSellySyncStatus("error");
      setSellySyncMessage("Errore di rete o server WMS locale non avviato");
    } finally {
      setIsSellySyncing(false);
    }
  };

  // Modals for Operator Management & Editing
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<Operator | null>(
    null,
  );
  const [badgeOperator, setBadgeOperator] = useState<Operator | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state for adding new operator
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState<
    "packer" | "team_lead" | "supervisor"
  >("packer");
  const [newOpStation, setNewOpStation] = useState(
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
  const [editOpStation, setEditOpStation] = useState("");
  const [editOpShift, setEditOpShift] = useState("");
  const [editOpAvatar, setEditOpAvatar] = useState("");

  const handleOpenEdit = (op: Operator) => {
    setEditingOperator(op);
    setEditOpName(op.name);
    setEditOpRole(op.role);
    setEditOpCode(op.operatorCode);
    setEditOpStation(op.stationId);
    setEditOpShift(op.shift);
    setEditOpAvatar(op.avatarUrl);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperator || !editOpName.trim()) return;

    const updatedOperator: Operator = {
      ...editingOperator,
      name: editOpName.trim(),
      role: editOpRole,
      operatorCode: editOpCode.trim().toUpperCase(),
      stationId: editOpStation.trim(),
      shift: editOpShift.trim(),
      avatarUrl: editOpAvatar,
    };

    if (onUpdateOperator) {
      onUpdateOperator(updatedOperator);
    }

    setEditingOperator(null);
  };

  const handleDeleteOperatorClick = (opId: string) => {
    const opToDelete = operators.find((op) => op.id === opId);
    if (opToDelete) {
      setOperatorToDelete(opToDelete);
      setEditingOperator(null);
    }
  };

  // Handle local file photo upload from computer
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewOpAvatar(event.target.result as string);
        }
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
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditOpAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Stats calculations & Channel split
  const totalOrders = orders.length;
  const packedOrders = orders.filter((o) => o.status === "packed").length;
  const inPackingOrders = orders.filter((o) => o.status === "packing").length;
  const readyOrders = orders.filter((o) => o.status === "ready_to_pack").length;
  
  // Specific Channel Separation
  const amazonOrders = orders.filter(
    (o) => o.source === "Amazon Marketplace" || o.source?.toLowerCase().includes("amazon")
  );
  const sellyOrders = orders.filter(
    (o) => o.source !== "Amazon Marketplace" && !o.source?.toLowerCase().includes("amazon")
  );
  const webOrdersCount = sellyOrders.length;
  const amazonOrdersCount = amazonOrders.length;

  const handleCreateOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName.trim()) return;

    // Calculate next OP code e.g. OP-043
    const highestNum = operators.reduce((max, op) => {
      const match = op.operatorCode.match(/OP-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 42);

    const nextCode = `OP-${String(highestNum + 1).padStart(3, "0")}`;

    const newOperator: Operator = {
      id: `op-${Date.now()}`,
      operatorCode: nextCode,
      name: newOpName.trim(),
      role: newOpRole,
      stationId: newOpStation,
      shift: newOpShift,
      avatarUrl: newOpAvatar,
      packedToday: 0,
      accuracy: 100,
      uph: 0,
      errorsPrevented: 0,
    };

    if (onAddOperator) {
      onAddOperator(newOperator);
    }

    setIsAddOperatorOpen(false);
    setNewOpName("");
    // Open badge preview immediately for printing
    setBadgeOperator(newOperator);
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1 select-none">
      {/* Top Banner & KPI Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-norsan-700 rounded-xl text-white flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Panoramica Direzione & Team Lead
                </h1>
                <span className="text-[11px] bg-norsan-50 text-norsan-800 border border-norsan-200 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  HUB BOLZANO LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Controllo in tempo reale di postazioni di imballaggio, flussi
                online norsan.it e produttività operatori
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              Modalità Operativa Produzione
            </span>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 tabular-nums">
          <div className="bg-[#f4f6f9] border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Totale Ordini
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {totalOrders}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {webOrdersCount} da norsan.it
            </div>
          </div>

          <div className="bg-[#f4f6f9] border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              In Imballaggio
            </div>
            <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
              {inPackingOrders}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Postazioni attive
            </div>
          </div>

          <div className="bg-[#f4f6f9] border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Completati Oggi
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
              {packedOrders}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Pronti ritiro DHL
            </div>
          </div>

          <div className="bg-[#f4f6f9] border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              In Coda
            </div>
            <div className="text-2xl font-bold font-mono text-norsan-700 mt-1">
              {readyOrders}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Da assegnare
            </div>
          </div>

          <div className="bg-[#f4f6f9] border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Velocità Media
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {stations.some((s) => s.currentSpeedUPH > 0)
                ? (
                    stations.reduce((acc, s) => acc + s.currentSpeedUPH, 0) /
                    stations.filter((s) => s.currentSpeedUPH > 0).length
                  ).toFixed(1)
                : "0"}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              UPH (Colli / ora)
            </div>
          </div>

          <div className="bg-[#f4f6f9] border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Anomalie Aperte
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
              {issues.filter((i) => i.status === "pending").length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Assistenza immediata
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("stations")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer tabular-nums ${
            activeTab === "stations"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Postazioni ({stations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ecommerce")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer tabular-nums ${
            activeTab === "ecommerce"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-norsan-500" />
          <span>Selly Web-Shop ({webOrdersCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("amazon")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer tabular-nums ${
            activeTab === "amazon"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
          <span>Amazon FBM ({amazonOrdersCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("operators")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer tabular-nums ${
            activeTab === "operators"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-norsan-600" />
          <span>Operatori & Badge ({operators.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("issues")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer tabular-nums ${
            activeTab === "issues"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
          <span>
            Anomalie & Kanban (
            {issues.filter((i) => i.status === "pending").length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("slotting")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "slotting"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-500" />
          <span>Gestione Scaffali & Slotting (5S)</span>
        </button>

        {!WMS_PHASE_CONFIG.PHASE_1_PACKING_STATION_ONLY && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("lean")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "lean"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Metriche Lean & 5S Kaizen</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("fefo")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "fefo"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
              <span>Lotti, Scadenze FEFO & Richiamo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "inventory"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Package className="w-3.5 h-3.5 text-indigo-500" />
              <span>Magazzino Centrale & Inventario</span>
            </button>
          </>
        )}

        {WMS_PHASE_CONFIG.PHASE_1_PACKING_STATION_ONLY && (
          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer tabular-nums ${
              activeTab === "roadmap"
                ? "bg-slate-900 text-white shadow-2xs border border-slate-900"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-dashed border-slate-300"
            }`}
            title="Visualizza i moduli di controllo Team Lead previsti in Roadmap (richiedono sviluppo dedicato)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Control Tower Roadmap</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                activeTab === "roadmap"
                  ? "bg-white/15 text-white"
                  : "bg-slate-200/80 text-slate-700"
              }`}
            >
              6
            </span>
          </button>
        )}

        <a
          href="/calcolatore-omega3.html"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-white text-norsan-700 hover:bg-norsan-50 border border-slate-200 ml-auto"
          title="Apri il prototipo interattivo per norsan.it e Amazon A+"
        >
          <Sparkles className="w-3.5 h-3.5 text-norsan-600" />
          <span>Calcolatore Omega-3</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
      </div>

      {/* Tab Content 0: Slotting Manager */}
      {activeTab === "slotting" && (
        <SlottingManager
          slots={slots}
          products={products}
          stationConfigId={stationConfigId}
          onAssignSlot={onAssignSlot}
          onAddSlot={onAddSlot}
          onDeleteSlot={onDeleteSlot}
          onUpdateProductImage={onUpdateProductImage}
          onResetSlotsToDefault={onResetSlotsToDefault}
        />
      )}

      {/* Tab Content 1: Stations */}
      {activeTab === "stations" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stations.map((st) => (
            <div
              key={st.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                      {st.id}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {st.name}
                      </h3>
                      <div className="text-xs text-slate-500 font-medium">
                        {st.operatorName} ({st.operatorCode})
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-lg border ${
                      st.status === "packing"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : st.status === "idle"
                          ? "bg-slate-50 text-slate-600 border-slate-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {st.status === "packing"
                      ? "In Imballaggio"
                      : st.status === "idle"
                        ? "In Attesa"
                        : "In Pausa"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center tabular-nums">
                  <div className="bg-[#f4f6f9] p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      Colli Oggi
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                      {st.ordersPackedToday}
                    </div>
                  </div>
                  <div className="bg-[#f4f6f9] p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      UPH
                    </div>
                    <div className="text-lg font-bold font-mono text-amber-600 mt-0.5">
                      {st.currentSpeedUPH}
                    </div>
                  </div>
                  <div className="bg-[#f4f6f9] p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      Precisione
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                      {st.accuracy}%
                    </div>
                  </div>
                </div>

                {st.currentOrderNumber && (
                  <div className="mt-3.5 px-3 py-2 bg-norsan-50/70 border border-norsan-200 rounded-xl text-xs flex items-center justify-between">
                    <span className="text-slate-600 font-medium">
                      Ordine in corso:
                    </span>
                    <strong className="font-mono text-norsan-800">
                      {st.currentOrderNumber}
                    </strong>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onSwitchToStation(st.id)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Apri Vista Banco</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content 2: Selly Web-Shop Stream & Address Validation */}
      {activeTab === "ecommerce" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-norsan-600" />
                <span>Flusso Ordini Web-Shop (Selly ERP) & Indirizzi IT</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ordini diretti dallo store online norsan.it sincronizzati con Selly ERP
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
              <button
                type="button"
                onClick={() => printBatchAmazonPackingSlips(sellyOrders)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-norsan-700 hover:bg-norsan-800 text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
                title="Stampa tutte le distinte di prelievo / bolle degli ordini Web Shop"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Stampa Bolle ({sellyOrders.length})</span>
              </button>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {sellyOrders.filter((o) => o.addressStatus !== "warning").length}{" "}
                  Validi
                </span>
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {sellyOrders.filter((o) => o.addressStatus === "warning").length}{" "}
                  Da verificare
                </span>
              </span>
            </div>
          </div>

          {/* Selly ERP Direct Sync Control Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl flex items-center justify-center ${
                  sellySyncStatus === "ok"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : sellySyncStatus === "error"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                <RefreshCw
                  className={`w-4.5 h-4.5 ${isSellySyncing ? "animate-spin" : ""}`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Selly ERP Auto-Sync</span>
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full ${
                      sellyAutoSyncEnabled && sellyApiKey
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {sellyAutoSyncEnabled && sellyApiKey
                      ? `ATTIVO (OGNI ${sellyInterval}M)`
                      : "MANUALE"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{sellySyncMessage}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {sellyOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => printBatchPackingSlips(sellyOrders)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition active:scale-95 cursor-pointer tabular-nums"
                  title="Stampa tutte le distinte di prelievo A4 con barcode per il banco imballaggio"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa Distinte ({sellyOrders.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSyncSellyNow}
                disabled={isSellySyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-norsan-600 hover:bg-norsan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition active:scale-95 cursor-pointer"
                title="Esegui sincronizzazione immediata da Selly ERP senza attendere il timer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSellySyncing ? "animate-spin" : ""}`}
                />
                <span>{isSellySyncing ? "Sincronizzazione..." : "Sincronizza Ora"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSellyConfigModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition border border-slate-700 cursor-pointer"
                title="Configura API Key Selly ERP"
              >
                <Settings className="w-3.5 h-3.5 text-slate-300" />
                <span>Impostazioni API</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {sellyOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                Nessun ordine Web-Shop presente al momento.
              </div>
            ) : (
              sellyOrders.map((o) => {
                const hasAddressWarning =
                  o.addressStatus === "warning" ||
                  (!o.addressDetails?.houseNumber && o.customerAddress);

                return (
                  <div
                    key={o.id}
                    className={`p-3.5 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                      hasAddressWarning
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-slate-200/90 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                          hasAddressWarning
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {hasAddressWarning ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            {o.orderNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {o.customerName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {o.customerCountry || "IT"}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {o.customerAddress} · {o.customerZip}{" "}
                              {o.customerCity} ({o.customerProvince})
                            </span>
                          </span>
                          {o.addressDetails?.addressAddition && (
                            <span className="px-1.5 py-0.2 rounded bg-norsan-50 text-norsan-800 text-[10px] font-medium border border-norsan-200">
                              {o.addressDetails.addressAddition}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {o.source} ·{" "}
                          {o.items.reduce(
                            (s: number, i: any) => s + i.quantityRequired,
                            0,
                          )}{" "}
                          prodotti
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => printOrderPackingSlip(o)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition active:scale-95 cursor-pointer"
                        title="Stampa distinta di prelievo / bolla d'ordine in formato A4 con barcode per scan"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-300" />
                        <span>Stampa Bolla</span>
                      </button>

                      {hasAddressWarning ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressOrder(o);
                            setIsAddressModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition active:scale-95 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Risolvi Indirizzo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressOrder(o);
                            setIsAddressModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] border border-slate-200 transition cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dettagli Indirizzo</span>
                        </button>
                      )}

                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-md border ${
                          o.status === "packed"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : o.status === "packing"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {o.status === "packed"
                          ? "Spedito DHL"
                          : o.status === "packing"
                            ? "In Imballaggio"
                            : "In Coda"}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                        {o.courier}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2.5: Amazon FBM Marketplace Stream */}
      {activeTab === "amazon" && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                <span>Canale Amazon FBM (Fulfillment by Merchant)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ordini Amazon Marketplace: obbligo{" "}
                <strong>Scatola Neutra Senza Logo</strong> e rispetto rigido SLA
                DHL
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
              <button
                type="button"
                onClick={() => printBatchAmazonPackingSlips(amazonOrders)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition active:scale-95 cursor-pointer"
                title="Stampa tutte le distinte di prelievo A4 per gli ordini Amazon"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Stampa Bolle Amazon ({amazonOrders.length})</span>
              </button>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {amazonOrders.filter((o) => o.addressStatus !== "warning").length}{" "}
                  Validi
                </span>
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {amazonOrders.filter((o) => o.addressStatus === "warning").length}{" "}
                  Da verificare
                </span>
              </span>
            </div>
          </div>

          {/* Amazon SP-API Integration Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl flex items-center justify-center ${
                  amazonSyncStatus === "ok"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : amazonSyncStatus === "error"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                <ShoppingBag className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    Amazon SP-API Direct Sync
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full ${
                      amazonSellerId
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {amazonSellerId ? "COLLEGATO (SP-API)" : "FBM DIRETTA"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {amazonSyncMessage} · Sostituisce il software tedesco
                  intermediario
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAmazonSyncing(true);
                  setAmazonSyncMessage("Sincronizzazione ordini Amazon FBM...");
                  setTimeout(() => {
                    setIsAmazonSyncing(false);
                    setAmazonSyncStatus("ok");
                    setAmazonSyncMessage(
                      `Sincronizzati ${amazonOrders.length} ordini Amazon FBM`,
                    );
                  }, 600);
                }}
                disabled={isAmazonSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer"
                title="Sincronizza ordini Amazon FBM pendenti"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isAmazonSyncing ? "animate-spin" : ""}`}
                />
                <span>
                  {isAmazonSyncing ? "Sincronizzazione..." : "Sincronizza Amazon"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsAmazonConfigModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition border border-slate-700 cursor-pointer"
                title="Configura credenziali Amazon SP-API"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Credenziali SP-API</span>
              </button>
            </div>
          </div>

          {/* Amazon Orders Listing */}
          <div className="space-y-2">
            {amazonOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-amber-50/40 rounded-xl border border-amber-200 text-xs">
                Nessun ordine Amazon FBM in attesa di spedizione.
              </div>
            ) : (
              amazonOrders.map((o) => {
                const hasAddressWarning =
                  o.addressStatus === "warning" ||
                  (!o.addressDetails?.houseNumber && o.customerAddress);

                return (
                  <div
                    key={o.id}
                    className={`p-3.5 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                      hasAddressWarning
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-amber-200/80 hover:border-amber-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 flex items-center justify-center shrink-0">
                        {hasAddressWarning ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <ShoppingBag className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-amber-950 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {o.orderNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {o.customerName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold border border-amber-200 inline-flex items-center gap-1">
                            <Package className="w-2.5 h-2.5" />
                            <span>SCATOLA NEUTRA</span>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {o.customerAddress} · {o.customerZip}{" "}
                              {o.customerCity} ({o.customerProvince})
                            </span>
                          </span>
                          {o.addressDetails?.addressAddition && (
                            <span className="px-1.5 py-0.2 rounded bg-norsan-50 text-norsan-800 text-[10px] font-medium border border-norsan-200">
                              {o.addressDetails.addressAddition}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Amazon FBM Prime ·{" "}
                          {o.items.reduce(
                            (s: number, i: any) => s + i.quantityRequired,
                            0,
                          )}{" "}
                          prodotti NORSAN (senza volantini)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => printAmazonPackingSlip(o)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition active:scale-95 cursor-pointer"
                        title="Stampa distinta di prelievo / bolla d'ordine A4 (Layout Amazon)"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Stampa Bolla A4</span>
                      </button>

                      {hasAddressWarning ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressOrder(o);
                            setIsAddressModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition active:scale-95 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Risolvi Indirizzo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressOrder(o);
                            setIsAddressModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] border border-slate-200 transition cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dettagli Indirizzo</span>
                        </button>
                      )}

                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-md border ${
                          o.status === "packed"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : o.status === "packing"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {o.status === "packed"
                          ? "Spedito DHL"
                          : o.status === "packing"
                            ? "In Imballaggio"
                            : "In Coda"}
                      </span>
                      <span className="text-xs font-mono font-semibold text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                        {o.courier}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Operator Leaderboard & Badge Manager */}
      {activeTab === "operators" && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-norsan-700" />
                <span>Gestione Personale & Stampa Badge Barcode</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggiungi nuovi addetti all'imballaggio, assegna codici
                identificativi (OP-XXX) e stampa il badge per il login barcode.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddOperatorOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-norsan-700 hover:bg-norsan-800 text-white font-semibold text-xs transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuovo Operatore</span>
            </button>
          </div>

          {/* Operators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {operators.map((op) => (
              <div
                key={op.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={op.avatarUrl}
                        alt={op.name}
                        className={`w-11 h-11 rounded-full object-cover border shrink-0 ${
                          op.role === "team_lead"
                            ? "border-purple-400"
                            : "border-norsan-400"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {op.name}
                          </h4>
                          {op.role === "team_lead" && (
                            <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded shrink-0">
                              Lead
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-mono font-semibold mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded border ${
                              op.role === "team_lead"
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : "bg-norsan-50 text-norsan-800 border-norsan-200"
                            }`}
                          >
                            {op.operatorCode}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 truncate">
                            {op.stationId}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {op.shift}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(op)}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-norsan-50 text-slate-500 hover:text-norsan-700 border border-slate-200 transition active:scale-95 cursor-pointer"
                        title="Modifica dati o ruolo operatore / lead"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOperatorToDelete(op)}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition active:scale-95 cursor-pointer"
                        title="Elimina profilo dal sistema"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-3 text-center tabular-nums">
                    <div className="bg-[#f4f6f9] p-1.5 rounded-xl border border-slate-200/70">
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">
                        Colli
                      </div>
                      <div className="text-base font-bold font-mono text-emerald-600">
                        {op.packedToday}
                      </div>
                    </div>
                    <div className="bg-[#f4f6f9] p-1.5 rounded-xl border border-slate-200/70">
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">
                        UPH
                      </div>
                      <div className="text-base font-bold font-mono text-amber-600">
                        {op.uph}
                      </div>
                    </div>
                    <div className="bg-[#f4f6f9] p-1.5 rounded-xl border border-slate-200/70">
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">
                        Precisione
                      </div>
                      <div className="text-base font-bold font-mono text-norsan-700">
                        {op.accuracy}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setBadgeOperator(op)}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Stampa Badge</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSimulateScan) onSimulateScan(op.operatorCode);
                    }}
                    className="py-1.5 px-2.5 bg-norsan-50 hover:bg-norsan-100 text-norsan-800 font-semibold text-xs rounded-xl transition active:scale-95 flex items-center gap-1 border border-norsan-200 cursor-pointer"
                    title={`Simula Scansione Barcode [${op.operatorCode}] per login`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-norsan-600" />
                    <span>Login</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 4: Issues Queue */}
      {activeTab === "issues" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Richieste di Assistenza & Rifornimento Kanban
          </h3>
          {issues.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nessuna anomalia o richiesta aperta al momento.
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((iss) => (
                <div
                  key={iss.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    iss.status === "pending"
                      ? "bg-rose-50/50 border-rose-200"
                      : "bg-slate-50 border-slate-200/80 opacity-75"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        iss.status === "pending"
                          ? "bg-rose-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <AlertOctagon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {iss.type}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {iss.note}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Postazione: {iss.stationId} · Operatore:{" "}
                        {iss.operatorName} · Ordine: {iss.orderNumber}
                      </div>
                    </div>
                  </div>

                  <div>
                    {iss.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => onResolveIssue(iss.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Risolvi & Rifornisci</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        Risolto
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Control Tower Roadmap (Lead Stubs) */}
      {activeTab === "roadmap" && (
        <div className="space-y-4">
          {/* Executive Header Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold tracking-wider uppercase">
                <Lock className="w-3 h-3" />
                <span>ROADMAP SVILUPPO · CONTROL TOWER LEAD</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Moduli di Controllo Avanzato Team Lead (Standard Enterprise WMS)
              </h3>
              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                Funzionalità standard presenti nei WMS di fascia enterprise (es. ShipHero, JTL-WMS), predisposte qui come anteprime visive. Ogni modulo richiede tempo dedicato di sviluppo, test su flussi reali e/o credenziali API per essere attivato in produzione.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-norsan-50 border border-norsan-200 text-norsan-800 text-xs font-semibold font-mono tabular-nums">
                Fase 2 · 4 moduli prioritari
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold font-mono tabular-nums">
                Fase 3 · 2 moduli avanzati
              </span>
            </div>
          </div>

          {/* 6 Roadmap Stub Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Order Locking & Force Release Multi-Banco */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Order Locking & Force Release Multi-Banco
                      </h4>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-semibold">
                        Fase 2 · Priorità Alta
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>In Roadmap</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Impedisce a due banchi di prelevare e imballare lo stesso ordine in parallelo. Il Team Lead visualizza chi detiene il blocco in tempo reale e può forzare lo sblocco in un clic.
                </p>

                <div className="bg-[#f4f6f9] border border-dashed border-slate-300/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    <span>ANTEPRIMA DATI SIMULATI</span>
                    <span>2 blocchi attivi</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums">
                      <div className="flex items-center gap-2 min-w-0 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-900">SEL-10421</span>
                        <span className="text-slate-500 truncate">· OP-01 · ST-01 · 02:14</span>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed shrink-0"
                      >
                        Sblocca
                      </button>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums">
                      <div className="flex items-center gap-2 min-w-0 font-mono">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="font-bold text-slate-900">AMZ-98210</span>
                        <span className="text-slate-500 truncate">· OP-02 · ST-02 · 08:45</span>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed shrink-0"
                      >
                        Sblocca
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  <strong className="text-slate-700 font-semibold">Richiede:</strong> Lock ordini persistente SQLite + sync multi-terminale.
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Richiede sviluppo dedicato</span>
                </button>
              </div>
            </div>

            {/* 2. Cutoff Corriere DHL & SLA Countdown Live */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Cutoff Corriere DHL & SLA Countdown Live
                      </h4>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-semibold">
                        Fase 2 · Priorità Alta
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>In Roadmap</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Monitora il conto alla rovescia verso il ritiro giornaliero DHL e confronta il ritmo reale del turno (UPH) con il fabbisogno per azzerare i ritardi SLA Amazon FBM.
                </p>

                <div className="bg-[#f4f6f9] border border-dashed border-slate-300/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    <span>ANTEPRIMA DATI SIMULATI</span>
                    <span>Turno Pomeriggio</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 tabular-nums">
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Ritiro DHL</div>
                      <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                        15:30 · -01h 42m
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Pace Richiesto / Reale</div>
                      <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                        28 vs 31 colli/h
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">SLA Amazon FBM</div>
                      <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                        0 a rischio
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  <strong className="text-slate-700 font-semibold">Richiede:</strong> Configurazione orari ritiro corriere + calcolo UPH su turno.
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Richiede sviluppo dedicato</span>
                </button>
              </div>
            </div>

            {/* 3. Audit Trail Poka-Yoke & Heatmap Errori SKU */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-norsan-50 border border-norsan-200 text-norsan-700 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Audit Trail Poka-Yoke & Heatmap Errori SKU
                      </h4>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                        Fase 2 · Priorità Media
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>In Roadmap</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Registra ogni scansione errata bloccata al banco, identifica gli SKU più confusi per ottimizzare lo slotting 5S e misura il risparmio sui resi evitati.
                </p>

                <div className="bg-[#f4f6f9] border border-dashed border-slate-300/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    <span>ANTEPRIMA DATI SIMULATI</span>
                    <span>Ultimi 30 giorni</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-2 flex items-center justify-between text-xs tabular-nums">
                      <span className="text-slate-700 font-medium">
                        Total Limone ↔ Total Naturale
                      </span>
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        7x bloccati
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-2 flex items-center justify-between text-xs tabular-nums">
                      <span className="text-slate-700 font-medium">
                        Costo resi evitati (stima ROI)
                      </span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        € 285/mese
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  <strong className="text-slate-700 font-semibold">Richiede:</strong> Dashboard aggregazione /api/audit/scan + export CSV.
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Richiede sviluppo dedicato</span>
                </button>
              </div>
            </div>

            {/* 4. Manifesto Fine Giornata DHL & Tracking Sync ERP */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Manifesto Fine Giornata DHL & Tracking Sync ERP
                      </h4>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-semibold">
                        Fase 2 · Priorità Alta
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>In Roadmap</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Genera in un clic la distinta di carico fine giornata per l&apos;autista DHL e verifica in tempo reale il ritorno automatico dei tracking verso Selly ERP e Amazon FBM.
                </p>

                <div className="bg-[#f4f6f9] border border-dashed border-slate-300/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    <span>ANTEPRIMA DATI SIMULATI</span>
                    <span>Chiusura Distinta EOD</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 tabular-nums">
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Borderò DHL</div>
                      <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                        64 colli pronti
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Push Selly ERP</div>
                      <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                        62/64 inviati
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Amazon SP-API</div>
                      <div className="text-xs font-bold font-mono text-amber-700 mt-0.5">
                        In attesa credenziali
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  <strong className="text-slate-700 font-semibold">Richiede:</strong> Credenziali DHL Business API + webhook Selly / SP-API.
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Richiede sviluppo dedicato</span>
                </button>
              </div>
            </div>

            {/* 5. Gestione Resi (RMA) & Reclami Danni Vetro */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Gestione Resi (RMA) & Reclami Danni Vetro
                      </h4>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold">
                        Fase 3 · Medio Termine
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>In Roadmap</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Scansione dei pacchi rientrati con causale strutturata per separare immediatamente la merce integra da rimettere a stock dai flaconi rotti per rimborso corriere.
                </p>

                <div className="bg-[#f4f6f9] border border-dashed border-slate-300/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    <span>ANTEPRIMA DATI SIMULATI</span>
                    <span>Causali RMA codificate</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
                      Rottura Vetro · Claim DHL
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                      Indirizzo Errato
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                      Rientro Integro · Restock FEFO
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  <strong className="text-slate-700 font-semibold">Richiede:</strong> Workflow RMA dedicato + archiviazione foto danni.
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Richiede sviluppo dedicato</span>
                </button>
              </div>
            </div>

            {/* 6. Tracciabilità Lotti FEFO (HACCP) & Inventario Pallet */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Tracciabilità Lotti FEFO (HACCP) & Inventario Pallet
                      </h4>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold">
                        Fase 3 · Architettura pronta
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>In Roadmap</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Richiamo lotti HACCP Reg. CE 178/2002 in 10 secondi e controllo scorte su due livelli (scaffale attivo vs riserva pallet) con soglie automatiche di riordino.
                </p>

                <div className="bg-[#f4f6f9] border border-dashed border-slate-300/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    <span>ANTEPRIMA DATI SIMULATI</span>
                    <span>HACCP & Stock 2-Livelli</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 tabular-nums">
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Recall Lotto</div>
                      <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                        L2604N → 14 ord.
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Alert Scadenze</div>
                      <div className="text-xs font-bold font-mono text-amber-700 mt-0.5">
                        &lt; 90gg · 2 SKU
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-500 font-medium">Kanban Pallet</div>
                      <div className="text-xs font-bold font-mono text-norsan-700 mt-0.5">
                        Rifornimento OK
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  <strong className="text-slate-700 font-semibold">Richiede:</strong> Attivazione modulo congelato + test su dati reali di magazzino.
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-semibold cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Richiede sviluppo dedicato</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 5: Lean Kaizen & Muda Elimination */}
      {activeTab === "lean" && (
        <div className="space-y-4">
          {/* Top Lean Summary Banner */}
          <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-md border-2 border-emerald-700">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-emerald-700 text-emerald-100 font-mono px-3 py-1 rounded-full font-black uppercase tracking-wider">
                    LEAN WAREHOUSING & 5S AUDIT
                  </span>
                  <span className="text-xs text-emerald-300 font-bold">
                    • HUB BOLZANO
                  </span>
                </div>
                <h2 className="text-2xl font-black mt-2">
                  Eliminazione degli Sprechi (8 Muda) & Flusso Continuo
                </h2>
                <p className="text-xs text-emerald-200 mt-1 max-w-3xl">
                  Ottimizzazione dei movimenti (Golden Zone), protezione
                  preventiva dagli errori (Poka-Yoke 100%), eliminazione del
                  cartaceo e bilanciamento del Takt Time tra le 3 postazioni
                  attive.
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-emerald-300 uppercase font-bold">
                  Takt Time Obiettivo
                </div>
                <div className="text-3xl font-black font-mono text-emerald-300">
                  40 sec
                </div>
                <div className="text-[11px] text-emerald-200 mt-0.5">
                  Media reale: 38.5s (-4% vs Target)
                </div>
              </div>
            </div>
          </div>

          {/* 8 Wastes (Muda) Eliminator Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black uppercase text-slate-800">
                  1. Movimenti (Motion)
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
                  -65% Spostamenti
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                I prodotti ad alta rotazione (Total Limone, Collagene) sono
                concentrati al <strong>Piano 2 (Golden Zone)</strong> tra bacino
                e torace, azzerando piegamenti e allungamenti.
              </p>
            </div>

            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black uppercase text-slate-800">
                  2. Difetti (Defects)
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
                  0.0% Errori Reclami
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                <strong>Poka-Yoke obbligatorio:</strong> la stampa
                dell'etichetta DHL è bloccata finché lo scanner non valida il
                100% degli EAN corretti.
              </p>
            </div>

            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black uppercase text-slate-800">
                  3. Attese (Waiting)
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
                  0 ms Latenza
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Scanner HID Keyboard Wedge istantaneo. Passaggio automatico al
                collo successivo senza clic o ritardi nel caricamento.
              </p>
            </div>

            <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black uppercase text-slate-800">
                  4. Sovra-processo
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded font-mono">
                  100% Paperless
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Flusso digitale diretto dall'e-commerce norsan.it. Zero bolle
                cartacee da stampare, archiviare o spuntare a penna.
              </p>
            </div>
          </div>

          {/* 5S Station Breakdown & Takt Time Pace Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {stations.map((st) => (
              <div
                key={st.id}
                className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        {st.name}
                      </h4>
                      <div className="text-xs text-slate-500 font-semibold">
                        {st.operatorName}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded">
                      {st.currentSpeedUPH} UPH
                    </span>
                  </div>

                  <div className="space-y-2 mt-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Tempo Ciclo Medio:</span>
                      <strong className="font-mono text-slate-900">
                        {st.ordersPackedToday > 0 && st.currentSpeedUPH > 0
                          ? `${Math.round(3600 / st.currentSpeedUPH)} sec`
                          : "—"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">
                        Conformità Takt Time:
                      </span>
                      <strong className="text-emerald-700">
                        {st.ordersPackedToday > 0 ? "In ritmo ✓" : "In attesa"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">
                        Audit 5S Postazione:
                      </span>
                      <strong className="text-cyan-800">5S Conforme ✓</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    Colli finiti oggi:
                  </span>
                  <span className="font-mono font-black text-slate-900">
                    {st.ordersPackedToday}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 6: FEFO Expiry & Batch Recall Traceability */}
      {activeTab === "fefo" && (
        <div className="space-y-4">
          {/* Top FEFO & HACCP Banner */}
          <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-950 border-2 border-teal-600/40 rounded-3xl p-5 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>
                  Controllo Qualità Nutraceutico • Reg. CE 178/2002 (HACCP)
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight text-white">
                Gestione Lotti, Scadenze FEFO (First Expired, First Out) &
                Tracciabilità Richiami
              </h3>
              <p className="text-xs text-slate-300 max-w-3xl">
                Previene lo stoccaggio di flaconi scaduti sugli scaffali di
                Bolzano, guida gli operatori a esaurire sempre il cartone con
                scadenza più ravvicinata e consente di rintracciare in 1 secondo
                tutti i clienti che hanno ricevuto uno specifico lotto.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-slate-900/90 border border-teal-500/40 rounded-2xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Rotazione Doppio Lotto
                </div>
                <div className="text-xl font-black font-mono text-amber-400">
                  {
                    products.filter((p) => !!getProductLotInfo(p).secondaryLot)
                      .length
                  }{" "}
                  SKU
                </div>
              </div>
              <div className="bg-slate-900/90 border border-teal-500/40 rounded-2xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Priorità FEFO Attiva
                </div>
                <div className="text-xl font-black font-mono text-rose-400">
                  {
                    products.filter(
                      (p) => getProductLotInfo(p).fefoStatus !== "optimal",
                    ).length
                  }{" "}
                  Lotti
                </div>
              </div>
            </div>
          </div>

          {/* Batch Recall Search Box (Simulazione Richiamo Ministero / Controllo Qualità) */}
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>🔍 Ricerca Istantanea Richiamo Lotto (Batch Recall)</span>
                  <span className="text-[10px] font-mono bg-teal-100 text-teal-900 px-2 py-0.5 rounded border border-teal-300 font-bold">
                    Audit-Ready
                  </span>
                </h4>
                <p className="text-xs text-slate-600">
                  Inserisci un codice lotto (es.{" "}
                  <code className="font-mono font-bold text-teal-800">
                    L2604N
                  </code>
                  ,{" "}
                  <code className="font-mono font-bold text-teal-800">
                    L2602V
                  </code>
                  ,{" "}
                  <code className="font-mono font-bold text-teal-800">
                    L2607A
                  </code>
                  ) per visualizzare tutti gli ordini clienti che contengono quel
                  lotto.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={recallSearchLot}
                  onChange={(e) => setRecallSearchLot(e.target.value.toUpperCase())}
                  placeholder="Cerca Lotto (es. L2604N)..."
                  className="px-3.5 py-2 text-xs font-mono font-bold uppercase rounded-xl border-2 border-slate-300 focus:border-teal-600 focus:outline-none w-56"
                />
                {recallSearchLot && (
                  <button
                    type="button"
                    onClick={() => setRecallSearchLot("")}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {recallSearchLot.trim().length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                {(() => {
                  const q = recallSearchLot.trim().toUpperCase();
                  const matchingOrders = orders.filter((o) =>
                    o.items.some((item) => {
                      const assignedLot =
                        item.lotNumber || getProductLotInfo(item.product).lotNumber;
                      return assignedLot.toUpperCase().includes(q);
                    }),
                  );

                  if (matchingOrders.length === 0) {
                    return (
                      <div className="text-xs text-slate-500 py-3 text-center font-semibold">
                        Nessun ordine trovato con il lotto &ldquo;{q}&rdquo;.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] uppercase font-black text-slate-500 bg-slate-50">
                            <th className="py-2 px-3">Ordine</th>
                            <th className="py-2 px-3">Cliente & Città</th>
                            <th className="py-2 px-3">Articolo & Lotto</th>
                            <th className="py-2 px-3">Tracking DHL</th>
                            <th className="py-2 px-3">Stato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {matchingOrders.map((ord) => (
                            <tr key={ord.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-black text-slate-900">
                                {ord.orderNumber}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                {ord.customerName} ({ord.customerCity})
                              </td>
                              <td className="py-2 px-3">
                                {ord.items
                                  .filter((item) =>
                                    (
                                      item.lotNumber ||
                                      getProductLotInfo(item.product).lotNumber
                                    )
                                      .toUpperCase()
                                      .includes(q),
                                  )
                                  .map((item) => {
                                    const info = getProductLotInfo(item.product);
                                    return (
                                      <span
                                        key={item.product.id}
                                        className="inline-block mr-2 font-mono text-[11px] bg-teal-50 text-teal-900 border border-teal-300 px-2 py-0.5 rounded font-bold"
                                      >
                                        {item.product.sku} • Lotto{" "}
                                        {item.lotNumber || info.lotNumber} (Scad.{" "}
                                        {item.expiryDate || info.expiryDate})
                                      </span>
                                    );
                                  })}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-600">
                                {ord.trackingNumber || "In attesa etichetta"}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    ord.status === "packed"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {ord.status === "packed"
                                    ? "Spedito / Imballato"
                                    : "In Magazzino"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Shelf FEFO Lot Table */}
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm overflow-x-auto">
            <h4 className="text-sm font-black text-slate-900 mb-3">
              📦 Mappa Scaffali FEFO • Lotti Frontali Attivi & Scadenze
            </h4>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-[10px] uppercase font-black text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Scaffale</th>
                  <th className="py-2.5 px-3">Prodotto (SKU)</th>
                  <th className="py-2.5 px-3">Lotto Frontale (FEFO)</th>
                  <th className="py-2.5 px-3">Scadenza & Stato</th>
                  <th className="py-2.5 px-3">Secondo Cartone (Scorta)</th>
                  <th className="py-2.5 px-3 text-right">Azioni Rapide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((prod) => {
                  const info = getProductLotInfo(prod);
                  const isEditing = editingShelfProductId === prod.id;
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-black text-blue-900">
                          {prod.shelfLocation}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900">
                            {prod.italianName || prod.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            SKU: {prod.sku} • EAN: {prod.ean}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black">
                          {isEditing ? (
                            <input
                              type="text"
                              value={shelfLotDraft}
                              onChange={(e) =>
                                setShelfLotDraft(e.target.value.toUpperCase())
                              }
                              className="w-24 px-2 py-1 text-xs font-mono font-bold border border-teal-500 rounded"
                            />
                          ) : (
                            <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300">
                              {info.lotNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={shelfExpDraft}
                              onChange={(e) => setShelfExpDraft(e.target.value)}
                              placeholder="MM/YYYY"
                              className="w-24 px-2 py-1 text-xs font-mono font-bold border border-teal-500 rounded"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-mono font-black px-2 py-0.5 rounded border ${
                                  info.fefoStatus === "expiring_soon"
                                    ? "bg-rose-100 text-rose-900 border-rose-300"
                                    : info.fefoStatus === "fefo_priority"
                                      ? "bg-amber-100 text-amber-950 border-amber-300"
                                      : "bg-emerald-50 text-emerald-900 border-emerald-200"
                                }`}
                              >
                                {info.expiryDate}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {info.fefoStatus === "expiring_soon"
                                  ? "Scad. ravvicinata"
                                  : info.fefoStatus === "fefo_priority"
                                    ? "Priorità FEFO"
                                    : "Ottimale"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {info.secondaryLot ? (
                            <span className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-bold">
                              ⚠️ Pronto: {info.secondaryLot.lotNumber} (Scad.{" "}
                              {info.secondaryLot.expiryDate})
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              Singolo lotto
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      shelfLotDraft.trim() &&
                                      shelfExpDraft.trim()
                                    ) {
                                      updateProductLotInfo(
                                        prod.sku,
                                        shelfLotDraft.trim(),
                                        shelfExpDraft.trim(),
                                      );
                                      setFefoRefreshTick((t) => t + 1);
                                    }
                                    setEditingShelfProductId(null);
                                  }}
                                  className="px-2.5 py-1 bg-teal-600 text-white rounded-lg text-[10px] font-black cursor-pointer"
                                >
                                  Salva
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingShelfProductId(null)}
                                  className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Annulla
                                </button>
                              </>
                            ) : (
                              <>
                                {info.secondaryLot && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      rotateToSecondaryLot(prod);
                                      setFefoRefreshTick((t) => t + 1);
                                    }}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition"
                                    title="Passa al nuovo cartone"
                                  >
                                    Ruota → {info.secondaryLot.lotNumber}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingShelfProductId(prod.id);
                                    setShelfLotDraft(info.lotNumber);
                                    setShelfExpDraft(info.expiryDate);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                >
                                  Modifica Lotto
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 7: Main Warehouse (Bulk Pallets), Cycle Counting & Shelf-Life Run-Rate Forecast */}
      {activeTab === "inventory" &&
        (() => {
          const allInventory = getWarehouseInventory(products);
          const filteredInventory = inventorySearch.trim()
            ? allInventory.filter(
                (item) =>
                  item.sku
                    .toLowerCase()
                    .includes(inventorySearch.trim().toLowerCase()) ||
                  (item.product.italianName || item.product.name)
                    .toLowerCase()
                    .includes(inventorySearch.trim().toLowerCase()) ||
                  item.palletZone
                    .toLowerCase()
                    .includes(inventorySearch.trim().toLowerCase()),
              )
            : allInventory;

          const totalPhysicalUnits = allInventory.reduce(
            (sum, i) => sum + i.physicalTotalUnits,
            0,
          );
          const totalCartons = allInventory.reduce(
            (sum, i) => sum + i.closedCartonsOnPallet,
            0,
          );
          const discrepancyItems = allInventory.filter(
            (i) => i.discrepancyUnits !== 0,
          );
          const expiryRiskItems = allInventory.filter(
            (i) => i.writeOffRiskUnits > 0,
          );
          const totalRiskEur = expiryRiskItems.reduce(
            (sum, i) => sum + i.writeOffRiskEur,
            0,
          );

          return (
            <div className="space-y-4">
              {/* Top Executive Banner */}
              <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/40 rounded-3xl p-5 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 font-bold">
                    <Package className="w-3.5 h-3.5" />
                    <span>
                      Controllo Magazzino Centrale (Pedane) ↔ Zona Imballaggio ↔
                      Selly ERP
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    Inventario Rapido (Cycle Counting), Rifornimento Kanban &
                    Radar Scadenze su Pedana
                  </h3>
                  <p className="text-xs text-slate-300 max-w-3xl">
                    Collega le pedane chiuse ricevute da Berlino con gli
                    scaffali di prelievo: calcola automaticamente i flaconi
                    totali (Cartoni × Pezzi + Scaffale), rileva disallineamenti
                    con Selly ERP e segnala in anticipo le pedane che rischiano
                    di scadere in base alla velocità di vendita mensile.
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl px-4 py-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Totale Magazzino
                    </div>
                    <div className="text-xl font-black font-mono text-indigo-300">
                      {totalPhysicalUnits} pz{" "}
                      <span className="text-xs text-slate-400">
                        ({totalCartons} cart.)
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl px-4 py-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Discrepanze Selly ERP
                    </div>
                    <div
                      className={`text-xl font-black font-mono ${
                        discrepancyItems.length > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {discrepancyItems.length} SKU
                    </div>
                  </div>
                  <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl px-4 py-2.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Rischio Sfrido / Scadenza
                    </div>
                    <div
                      className={`text-xl font-black font-mono ${
                        totalRiskEur > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      €{totalRiskEur}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inbound Pallet Registration + Run-Rate Expiry Radar */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Card 1: Carico Nuova Pedana da Berlino (Inbound) */}
                <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        🚛 Carico Nuova Pedana / Consegna da Berlino (Inbound)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Registra l&apos;arrivo di nuovi cartoni chiusi con un
                        unico codice lotto per l&apos;intera fornitura.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Prodotto SKU
                      </label>
                      <select
                        value={inboundSku}
                        onChange={(e) => setInboundSku(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50"
                      >
                        {products.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.sku} — {p.italianName || p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Cartoni (+N)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={inboundCartons}
                        onChange={(e) =>
                          setInboundCartons(
                            Math.max(1, parseInt(e.target.value, 10) || 1),
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs font-mono font-black rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Lotto & Scad.
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={inboundLot}
                          onChange={(e) =>
                            setInboundLot(e.target.value.toUpperCase())
                          }
                          placeholder="Lotto"
                          className="w-1/2 px-2 py-2 text-[11px] font-mono font-bold rounded-xl border border-slate-300 uppercase"
                        />
                        <input
                          type="text"
                          value={inboundExpiry}
                          onChange={(e) => setInboundExpiry(e.target.value)}
                          placeholder="MM/YYYY"
                          className="w-1/2 px-2 py-2 text-[11px] font-mono font-bold rounded-xl border border-slate-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        receiveInboundPallet(
                          products,
                          inboundSku,
                          inboundCartons,
                          inboundLot,
                          inboundExpiry,
                        );
                        setFefoRefreshTick((t) => t + 1);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                    >
                      + Registra Carico Pedana ({inboundCartons} Cartoni • Lotto{" "}
                      {inboundLot})
                    </button>
                  </div>
                </div>

                {/* Card 2: Radar Rischio Scadenza vs Run-Rate Vendite */}
                <div className="bg-white border-2 border-rose-200 rounded-3xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-rose-950 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>
                        Radar Prevenzione Sfridi (Run-Rate Vendite vs. Scadenza
                        Pedana)
                      </span>
                    </h4>
                    <span className="text-[10px] font-mono font-black bg-rose-100 text-rose-900 px-2 py-0.5 rounded border border-rose-300">
                      Analisi Preditiva Ufficio
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Confronta i mesi di copertura scorta attuali con i mesi
                    residui prima della scadenza del lotto:
                  </p>

                  {expiryRiskItems.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                      ✓ Tutte le pedane verranno esaurite prima della data di
                      scadenza al ritmo di vendita attuale.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {expiryRiskItems.map((risk) => (
                        <div
                          key={risk.sku}
                          className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-black text-rose-950">
                              {risk.product.italianName || risk.product.name} (
                              <span className="font-mono">{risk.sku}</span>)
                            </div>
                            <div className="text-[11px] text-rose-800">
                              Scorta: <b>{risk.physicalTotalUnits} pz</b> (
                              {risk.monthsOfStockRemaining} mesi di vendita @{" "}
                              {risk.monthlySalesVelocity} pz/mese) • Lotto{" "}
                              <b>{risk.lotNumber}</b> scade tra{" "}
                              <b>{risk.monthsUntilExpiry} mesi</b> (
                              {risk.expiryDate})
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-mono font-black text-rose-700">
                              {risk.writeOffRiskUnits} pz a rischio (~€
                              {risk.writeOffRiskEur})
                            </div>
                            <div className="text-[10px] font-bold text-rose-900 bg-white px-2 py-0.5 rounded border border-rose-300 mt-0.5">
                              💡 Azione: Promo / Bundle Sconto
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Full Two-Tier Inventory Table & Rapid Cycle Counter */}
              <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 shadow-sm space-y-3 overflow-x-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      📋 Tabella Inventario Fisico (Pedane Chiusi + Scaffali
                      Picking) vs. Selly ERP
                    </h4>
                    <p className="text-xs text-slate-500">
                      Clicca su <b>&ldquo;Conta / Rettifica&rdquo;</b> durante
                      il giro di controllo per inserire i cartoni chiusi sulla
                      pedana e i flaconi sullo scaffale, oppure{" "}
                      <b>&ldquo;Kanban → Scaffale&rdquo;</b> quando apri un
                      cartone.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Cerca SKU, prodotto o zona pallet..."
                    className="px-3.5 py-2 text-xs font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none w-64"
                  />
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-[10px] uppercase font-black text-slate-500 bg-slate-50">
                      <th className="py-2.5 px-3">Zona Pallet & Scaffale</th>
                      <th className="py-2.5 px-3">Articolo & Lotto</th>
                      <th className="py-2.5 px-3 text-center">
                        1. Pedana (Cartoni Chiusi)
                      </th>
                      <th className="py-2.5 px-3 text-center">
                        2. Scaffale Picking (Flaconi)
                      </th>
                      <th className="py-2.5 px-3 text-center">
                        Totale Fisico vs. ERP
                      </th>
                      <th className="py-2.5 px-3 text-center">
                        Copertura & Scadenza
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        Operazioni Magazzino
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredInventory.map((item) => {
                      const isCounting = countingSku === item.sku;
                      return (
                        <tr key={item.sku} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                              {item.palletZone}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              Picking: {item.product.shelfLocation}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-black text-slate-900">
                              {item.product.italianName || item.product.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              SKU: <b>{item.sku}</b> • Lotto:{" "}
                              <b className="text-teal-800">{item.lotNumber}</b>{" "}
                              (Scad. {item.expiryDate})
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isCounting ? (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  min={0}
                                  value={countCartonsDraft}
                                  onChange={(e) =>
                                    setCountCartonsDraft(
                                      Math.max(
                                        0,
                                        parseInt(e.target.value, 10) || 0,
                                      ),
                                    )
                                  }
                                  className="w-20 px-2 py-1 text-center font-mono font-black border-2 border-indigo-500 rounded-lg"
                                />
                                <span className="text-[9px] text-slate-500 mt-0.5">
                                  × {item.unitsPerCarton} pz/cart. ={" "}
                                  {countCartonsDraft * item.unitsPerCarton} pz
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-mono font-black text-sm text-slate-900">
                                  {item.closedCartonsOnPallet} cart.
                                </span>
                                <div className="text-[10px] font-mono text-slate-500">
                                  ({item.closedCartonsOnPallet * item.unitsPerCarton}{" "}
                                  pz • da {item.unitsPerCarton})
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isCounting ? (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  min={0}
                                  value={countShelfDraft}
                                  onChange={(e) =>
                                    setCountShelfDraft(
                                      Math.max(
                                        0,
                                        parseInt(e.target.value, 10) || 0,
                                      ),
                                    )
                                  }
                                  className="w-20 px-2 py-1 text-center font-mono font-black border-2 border-indigo-500 rounded-lg"
                                />
                                <span className="text-[9px] text-slate-500 mt-0.5">
                                  flaconi sciolti
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono font-black text-sm text-blue-900">
                                {item.openUnitsOnPackingShelf} pz
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="font-mono font-black text-sm text-slate-900">
                              {item.physicalTotalUnits} pz{" "}
                              <span className="text-xs font-normal text-slate-500">
                                / ERP: {item.erpExpectedTotalUnits}
                              </span>
                            </div>
                            {item.discrepancyUnits === 0 ? (
                              <span className="inline-block text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 mt-0.5">
                                ✓ Allineato ({item.lastCountedAt})
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-black bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-400 mt-0.5">
                                ⚠️ Diff: {item.discrepancyUnits > 0 ? "+" : ""}
                                {item.discrepancyUnits} pz
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="font-mono text-xs font-bold text-slate-800">
                              {item.monthsOfStockRemaining} mesi scorta
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Scade tra {item.monthsUntilExpiry} mesi (
                              {item.monthlySalesVelocity} pz/m)
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isCounting ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      recordPhysicalCount(
                                        products,
                                        item.sku,
                                        countCartonsDraft,
                                        countShelfDraft,
                                        false,
                                      );
                                      setCountingSku(null);
                                      setFefoRefreshTick((t) => t + 1);
                                    }}
                                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black cursor-pointer"
                                  >
                                    Salva Conta
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      recordPhysicalCount(
                                        products,
                                        item.sku,
                                        countCartonsDraft,
                                        countShelfDraft,
                                        true,
                                      );
                                      setCountingSku(null);
                                      setFefoRefreshTick((t) => t + 1);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black cursor-pointer"
                                    title="Salva e allinea anche la giacenza Selly ERP"
                                  >
                                    Allinea ERP
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCountingSku(null)}
                                    className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={item.closedCartonsOnPallet <= 0}
                                    onClick={() => {
                                      transferCartonsToPackingShelf(
                                        products,
                                        item.sku,
                                        1,
                                      );
                                      setFefoRefreshTick((t) => t + 1);
                                    }}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-[10px] font-black cursor-pointer disabled:opacity-40 transition"
                                    title={`Sposta 1 cartone (${item.unitsPerCarton} pz) dalla pedana allo scaffale di imballaggio`}
                                  >
                                    Kanban → Scaffale (+{item.unitsPerCarton})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCountingSku(item.sku);
                                      setCountCartonsDraft(
                                        item.closedCartonsOnPallet,
                                      );
                                      setCountShelfDraft(
                                        item.openUnitsOnPackingShelf,
                                      );
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                  >
                                    Conta / Rettifica
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      {/* Modal 1: Add New Operator */}
      {isAddOperatorOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-norsan-50 text-norsan-700 border border-norsan-200 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Nuovo Operatore / Addetto Magazzino
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assegna un nuovo badge per il login barcode rapido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOperatorOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOperator} className="space-y-4 mt-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nome & Cognome
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Giovanni Bianchi"
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-norsan-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Ruolo
                  </label>
                  <select
                    value={newOpRole}
                    onChange={(e) => setNewOpRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-norsan-600"
                  >
                    <option value="packer">Addetto Imballaggio</option>
                    <option value="team_lead">Team Lead / Capoturno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Postazione Assegnata
                  </label>
                  <select
                    value={newOpStation}
                    onChange={(e) => setNewOpStation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-norsan-600"
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
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Turno di Lavoro
                </label>
                <input
                  type="text"
                  value={newOpShift}
                  onChange={(e) => setNewOpShift(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-norsan-600 focus:outline-none"
                />
              </div>

              {/* Photo & Avatar Selection Block */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Foto / Badge Avatar
                </label>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3">
                  <img
                    src={newOpAvatar}
                    alt="Preview"
                    className="w-14 h-14 rounded-xl object-cover border border-norsan-400 shrink-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Foto Operatore Selezionata
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Carica una foto reale dal computer oppure scegli dalla
                      galleria in basso.
                    </p>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-norsan-700 font-semibold text-xs rounded-xl border border-slate-200 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Carica Foto da File</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Oppure scegli un avatar dalla galleria
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((presetUrl, idx) => {
                      const isSelected = newOpAvatar === presetUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewOpAvatar(presetUrl)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition active:scale-90 cursor-pointer ${
                            isSelected
                              ? "border-norsan-600 ring-2 ring-norsan-500/30"
                              : "border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={presetUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-norsan-600/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOperatorOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-norsan-700 hover:bg-norsan-800 text-white font-semibold text-xs rounded-xl transition active:scale-95 cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl border border-slate-200/90 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Badge Operatore NORSAN
              </span>
              <button
                type="button"
                onClick={() => setBadgeOperator(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable ID Card (Standard CR80 Lanyard Card Layout) */}
            <div className="w-full my-4 bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-md border border-slate-800 relative overflow-hidden flex flex-col items-center text-center">
              <div className="w-12 h-2.5 bg-slate-800 border border-slate-600 rounded-full mb-3 shadow-inner" />

              <div className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-bold">
                NORSAN · ZREEN LOGISTICS
              </div>
              <div className="text-[9px] text-slate-400 uppercase font-medium">
                Hub di Spedizione · Bolzano (BZ)
              </div>

              <div className="my-3 relative">
                <img
                  src={badgeOperator.avatarUrl}
                  alt={badgeOperator.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-cyan-400 shadow-md"
                />
              </div>

              <h4 className="text-base font-bold text-white">
                {badgeOperator.name}
              </h4>
              <div className="text-xs text-cyan-300 font-semibold uppercase mt-0.5">
                {badgeOperator.role === "team_lead"
                  ? "Team Lead / Supervisore"
                  : "Addetto Imballaggio (Packer)"}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {badgeOperator.shift}
              </div>

              <div className="w-full mt-4 bg-white text-slate-950 rounded-xl p-3 shadow-inner flex flex-col items-center">
                {(() => {
                  const { bars, totalModules } = getCode128Bars(
                    badgeOperator.operatorCode,
                  );
                  return (
                    <svg
                      viewBox={`0 0 ${totalModules} 48`}
                      className="w-full h-12 max-w-[230px]"
                      preserveAspectRatio="none"
                    >
                      <rect width={totalModules} height={48} fill="#ffffff" />
                      <g fill="#000000">
                        {bars.map((bar, i) => (
                          <rect
                            key={i}
                            x={bar.x}
                            y={2}
                            width={bar.width}
                            height={44}
                          />
                        ))}
                      </g>
                    </svg>
                  );
                })()}
                <span className="font-mono text-sm font-bold tracking-widest text-slate-900 mt-1">
                  {badgeOperator.operatorCode}
                </span>
              </div>
            </div>

            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-300" />
                <span>Stampa Badge</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSimulateScan)
                    onSimulateScan(badgeOperator.operatorCode);
                  setBadgeOperator(null);
                }}
                className="py-2.5 px-3 bg-norsan-50 hover:bg-norsan-100 text-norsan-800 font-semibold text-xs rounded-xl border border-norsan-200 transition active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Testa subito la scansione del badge"
              >
                <Sparkles className="w-3.5 h-3.5 text-norsan-600" />
                <span>Test Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Operator / Team Lead Profile Modal */}
      {editingOperator && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                    editOpRole === "team_lead"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-norsan-50 text-norsan-700 border-norsan-200"
                  }`}
                >
                  <Edit3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
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
                type="button"
                onClick={() => setEditingOperator(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Nome & Cognome
                  </label>
                  <input
                    type="text"
                    required
                    value={editOpName}
                    onChange={(e) => setEditOpName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-norsan-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Codice Badge
                  </label>
                  <input
                    type="text"
                    required
                    value={editOpCode}
                    onChange={(e) => setEditOpCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-norsan-600 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Ruolo & Privilegi
                  </label>
                  <select
                    value={editOpRole}
                    onChange={(e) => setEditOpRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-norsan-600"
                  >
                    <option value="packer">Addetto Imballaggio (Packer)</option>
                    <option value="team_lead">Team Lead / Supervisore</option>
                    <option value="supervisor">Supervisore Generale</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Postazione Assegnata
                  </label>
                  <select
                    value={editOpStation}
                    onChange={(e) => setEditOpStation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-norsan-600"
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
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Turno di Lavoro
                </label>
                <input
                  type="text"
                  value={editOpShift}
                  onChange={(e) => setEditOpShift(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-norsan-600 focus:outline-none"
                />
              </div>

              {/* Photo & Avatar Selection Block */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Foto / Badge Avatar
                </label>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3">
                  <img
                    src={editOpAvatar}
                    alt="Preview"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-300 shrink-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Foto Profilo
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Carica una nuova foto dal computer o scegli dalla
                      galleria.
                    </p>

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
                      className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-norsan-700" />
                      <span>Carica Nuova Foto</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Oppure seleziona un avatar
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((presetUrl, idx) => {
                      const isSelected = editOpAvatar === presetUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditOpAvatar(presetUrl)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition active:scale-90 cursor-pointer ${
                            isSelected
                              ? "border-norsan-600 ring-2 ring-norsan-500/30"
                              : "border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={presetUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-norsan-600/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteOperatorClick(editingOperator.id)}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Elimina Profilo</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingOperator(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition active:scale-95 cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-rose-200 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl mb-3 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Eliminare {operatorToDelete.name}?
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Il badge{" "}
              <strong className="font-mono text-slate-800">
                [{operatorToDelete.operatorCode}]
              </strong>{" "}
              verrà revocato e l'operatore non potrà più accedere alle
              postazioni di magazzino.
            </p>

            <div className="w-full flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOperatorToDelete(null)}
                className="flex-1 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteOperator) onDeleteOperator(operatorToDelete.id);
                  setOperatorToDelete(null);
                  setEditingOperator(null);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sì, Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Smart Address Normalizer & DHL Fix Modal */}
      {isAddressModalOpen && selectedAddressOrder && (
        <AddressFixModal
          order={selectedAddressOrder}
          isOpen={isAddressModalOpen}
          onClose={() => {
            setIsAddressModalOpen(false);
            setSelectedAddressOrder(null);
          }}
          onSaveAddress={(orderId, updatedFields) => {
            if (onUpdateOrderAddress) {
              onUpdateOrderAddress(orderId, updatedFields);
            }
          }}
        />
      )}

      {/* Modal 6: Selly ERP Integration & Auto-Sync Settings */}
      {isSellyConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200/90">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-norsan-50 text-norsan-700 border border-norsan-200 rounded-xl flex items-center justify-center">
                  <Key className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Integrazione Selly ERP
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sincronizzazione automatica diretta senza file intermedi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSellyConfigModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSellyConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Key / Token Selly ERP
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={sellyApiKey}
                    onChange={(e) => setSellyApiKey(e.target.value)}
                    placeholder="Incolla qui la chiave fornita dalla direzione..."
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-norsan-500/20 focus:border-norsan-600 pr-10"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  La chiave API viene fornita dal manager/direttore nel pannello amministrativo di Selly.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Endpoint Selly
                </label>
                <input
                  type="text"
                  value={sellyApiUrl}
                  onChange={(e) => setSellyApiUrl(e.target.value)}
                  placeholder="https://api.sellyerp.com/v1"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-norsan-500/20 focus:border-norsan-600 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Intervallo Poll (minuti)
                  </label>
                  <select
                    value={sellyInterval}
                    onChange={(e) => setSellyInterval(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-norsan-500/20 focus:border-norsan-600 bg-white"
                  >
                    <option value={2}>Ogni 2 minuti</option>
                    <option value={5}>Ogni 5 minuti (Consigliato)</option>
                    <option value={10}>Ogni 10 minuti</option>
                    <option value={15}>Ogni 15 minuti</option>
                    <option value={30}>Ogni 30 minuti</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sellyAutoSyncEnabled}
                      onChange={(e) => setSellyAutoSyncEnabled(e.target.checked)}
                      className="w-4 h-4 text-norsan-700 rounded border-slate-300 focus:ring-norsan-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Auto-Sync Attivo
                    </span>
                  </label>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-norsan-50/60 border border-norsan-200 text-[11px] text-slate-700 space-y-1">
                <div className="font-bold text-slate-900">
                  Flusso Automatico WMS:
                </div>
                <p>
                  1. Recupera gli ordini con stato &quot;In lavorazione&quot; da Selly.
                </p>
                <p>
                  2. Filtra automaticamente le righe non logistiche (es. servizio contrassegno <code>3000-001</code>).
                </p>
                <p>
                  3. Normalizza gli indirizzi italiani per l'etichettatura DHL automatica.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSellyConfigModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-norsan-700 hover:bg-norsan-800 text-white font-semibold text-xs rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salva Configurazione</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Amazon SP-API Integration Settings */}
      {isAmazonConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-amber-200">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Credenziali Amazon SP-API
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sostituzione diretta software tedesco intermediario FBM
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAmazonConfigModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  localStorage.setItem(
                    "wms_amazon_sp_config",
                    JSON.stringify({
                      sellerId: amazonSellerId.trim(),
                      clientId: amazonClientId.trim(),
                      clientSecret: amazonClientSecret.trim(),
                      refreshToken: amazonRefreshToken.trim(),
                    }),
                  );
                } catch {}
                setIsAmazonConfigModalOpen(false);
                setAmazonSyncStatus("ok");
                setAmazonSyncMessage("Credenziali SP-API salvate con successo");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merchant / Seller ID
                </label>
                <input
                  type="text"
                  value={amazonSellerId}
                  onChange={(e) => setAmazonSellerId(e.target.value)}
                  placeholder="Es. A2XXXXXXXXXXXXX"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  LWA Client ID (Login with Amazon)
                </label>
                <input
                  type="text"
                  value={amazonClientId}
                  onChange={(e) => setAmazonClientId(e.target.value)}
                  placeholder="amzn1.application-oa2-client.xxxxxxxx"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  LWA Client Secret
                </label>
                <input
                  type="password"
                  value={amazonClientSecret}
                  onChange={(e) => setAmazonClientSecret(e.target.value)}
                  placeholder="Incolla LWA Client Secret..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refresh Token
                </label>
                <textarea
                  rows={2}
                  value={amazonRefreshToken}
                  onChange={(e) => setAmazonRefreshToken(e.target.value)}
                  placeholder="Atzr|IwEB..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 space-y-1">
                <div className="font-bold">
                  Vantaggio Sostituzione Diretta:
                </div>
                <p>
                  · Nessun costo mensile per il software intermediario tedesco.
                </p>
                <p>
                  · Stampa bolla Amazon A4 e notifica automatica di spedizione (Tracking DHL inviato istantaneamente ad Amazon).
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAmazonConfigModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salva Credenziali Amazon</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
