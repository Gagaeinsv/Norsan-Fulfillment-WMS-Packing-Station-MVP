import { parseItalianAddress } from "../../src/services/italianAddressParser";

export interface SellyConfig {
  apiUrl: string;
  apiKey: string;
  syncIntervalMinutes: number;
  isEnabled: boolean;
  lastSyncTimestamp?: number;
  lastSyncStatus?: "ok" | "error" | "idle";
  lastSyncMessage?: string;
  ordersImportedTotal: number;
}

// In-memory / environment configuration
let config: SellyConfig = {
  apiUrl: process.env.SELLY_API_URL || "https://api.sellyerp.com/v1",
  apiKey: process.env.SELLY_API_KEY || "",
  syncIntervalMinutes: parseInt(process.env.SELLY_SYNC_INTERVAL_MIN || "5", 10),
  isEnabled: process.env.SELLY_AUTO_SYNC === "true",
  ordersImportedTotal: 0,
  lastSyncStatus: "idle",
};

let syncTimer: NodeJS.Timeout | null = null;
type OrderImportCallback = (orders: any[]) => void;
let onOrdersImported: OrderImportCallback | null = null;

export function getSellySyncConfig(): SellyConfig {
  return { ...config };
}

export function updateSellySyncConfig(partial: Partial<SellyConfig>): SellyConfig {
  config = { ...config, ...partial };
  
  if (config.isEnabled && config.apiKey) {
    startSellyAutoSync();
  } else {
    stopSellyAutoSync();
  }
  
  return { ...config };
}

export function registerOrderSyncListener(callback: OrderImportCallback) {
  onOrdersImported = callback;
}

/**
 * Triggers an immediate sync poll against Selly ERP API
 */
export async function fetchNewOrdersFromSelly(): Promise<{
  success: boolean;
  count: number;
  message: string;
  orders?: any[];
}> {
  if (!config.apiKey) {
    config.lastSyncStatus = "idle";
    config.lastSyncMessage = "In attesa di API Key da parte della direzione";
    return {
      success: false,
      count: 0,
      message: "API Key mancante. Inserisci la chiave API fornita dalla direzione.",
    };
  }

  config.lastSyncTimestamp = Date.now();

  try {
    // Calling Selly ERP REST API endpoint for unfulfilled orders
    const response = await fetch(`${config.apiUrl}/orders?status=to_fulfill&limit=50`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      config.lastSyncStatus = "error";
      config.lastSyncMessage = `Selly HTTP ${response.status}: ${errText.slice(0, 80)}`;
      return {
        success: false,
        count: 0,
        message: config.lastSyncMessage,
      };
    }

    const rawData: any = await response.json();
    const rawOrders = Array.isArray(rawData) ? rawData : rawData.orders || [];

    // Transform and normalize orders using italianAddressParser and SKU filter
    const normalizedOrders = rawOrders.map((raw: any) => {
      const addressDetails = parseItalianAddress(
        raw.shipping_address || raw.address || ""
      );

      // Filter out non-physical service items (e.g. 3000-001 Spedizione DHL €0.00)
      const physicalItems = (raw.items || []).filter((item: any) => {
        const sku = String(item.sku || "").toUpperCase();
        return (
          !sku.startsWith("3000-") &&
          !sku.includes("SPEDIZIONE") &&
          !sku.includes("SHIPPING")
        );
      });

      return {
        id: `selly-${raw.id || Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderNumber: raw.order_number || raw.reference || `INT-${raw.id}`,
        barcode: raw.order_number || raw.reference || `INT-${raw.id}`,
        source: raw.channel?.includes("amazon")
          ? "Amazon Marketplace"
          : "SellyErp INT",
        createdAt: new Date(raw.created_at || Date.now()).getTime(),
        customerName: raw.customer_name || raw.recipient || "Cliente Norsan",
        customerAddress: addressDetails.street
          ? `${addressDetails.street} ${addressDetails.houseNumber || ""}`
          : raw.shipping_address,
        customerCity: raw.city || addressDetails.city || "Bolzano",
        customerZip: raw.zip || addressDetails.zip || "39100",
        customerProvince: raw.province || addressDetails.province || "BZ",
        customerCountry: raw.country || "IT",
        courier: raw.express ? "DHL Express" : "DHL Paket",
        trackingNumber: raw.tracking_number || "",
        priority: raw.express ? "express" : "standard",
        boxBranding: raw.channel?.includes("amazon")
          ? "neutral_unbranded"
          : "norsan_logo",
        boxRecommendation: "BOX-NOR-M",
        items: physicalItems,
        marketingFlyers: [],
        status: "ready_to_pack",
        isSubscription: !!raw.is_subscription,
        customerOrderCount: raw.customer_order_count || 1,
        addressDetails,
        addressStatus: addressDetails.status,
      };
    });

    config.lastSyncStatus = "ok";
    config.ordersImportedTotal += normalizedOrders.length;
    config.lastSyncMessage = `Sincronizzazione completata: ${normalizedOrders.length} nuovi ordini acquisiti con successo.`;

    if (onOrdersImported && normalizedOrders.length > 0) {
      onOrdersImported(normalizedOrders);
    }

    return {
      success: true,
      count: normalizedOrders.length,
      message: config.lastSyncMessage,
      orders: normalizedOrders,
    };
  } catch (err: any) {
    config.lastSyncStatus = "error";
    config.lastSyncMessage = `Errore connessione Selly API: ${err.message || String(err)}`;
    return {
      success: false,
      count: 0,
      message: config.lastSyncMessage,
    };
  }
}

/**
 * Starts the automated recurring sync daemon
 */
export function startSellyAutoSync() {
  stopSellyAutoSync();
  const intervalMs = Math.max(1, config.syncIntervalMinutes) * 60 * 1000;
  
  // Run first check immediately
  fetchNewOrdersFromSelly().catch(() => {});

  // Schedule recurring checks
  syncTimer = setInterval(() => {
    fetchNewOrdersFromSelly().catch(() => {});
  }, intervalMs);

  config.isEnabled = true;
}

/**
 * Stops recurring sync
 */
export function stopSellyAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  config.isEnabled = false;
}
