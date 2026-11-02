import { Product, Order, Operator } from "../types/wms";
import {
  WarehouseSlotData,
  generateBolzanoDefaultSlots,
} from "../components/rack/rackTypes";
import { NORSAN_PRODUCTS } from "../data/norsanProducts";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `http://${window.location.hostname}:3001/api`;

export const DEFAULT_SLOTS: WarehouseSlotData[] = generateBolzanoDefaultSlots(NORSAN_PRODUCTS);

// LocalStorage helpers for MVP frontend-only mode
function getLocalProducts(): Product[] {
  const saved = localStorage.getItem("wms_products");
  const customImagesRaw = localStorage.getItem("wms_custom_product_images");
  const customImages: Record<string, string> = customImagesRaw
    ? JSON.parse(customImagesRaw)
    : {};

  if (!saved) {
    return NORSAN_PRODUCTS.map((p) => ({
      ...p,
      imageUrl: customImages[p.id] || p.imageUrl,
    }));
  }
  try {
    const parsed: Product[] = JSON.parse(saved);
    return NORSAN_PRODUCTS.map((prod) => {
      const savedProd = parsed.find(
        (p) => p.id === prod.id || p.sku === prod.sku,
      );
      const base = savedProd ? { ...prod, ...savedProd } : prod;
      return {
        ...base,
        imageUrl: customImages[prod.id] || base.imageUrl,
        aliases: Array.from(
          new Set([...(prod.aliases || []), ...(savedProd?.aliases || [])]),
        ),
      };
    });
  } catch {
    return NORSAN_PRODUCTS.map((p) => ({
      ...p,
      imageUrl: customImages[p.id] || p.imageUrl,
    }));
  }
}

function setLocalProducts(products: Product[]) {
  localStorage.setItem("wms_products", JSON.stringify(products));
}

function getLocalSlots(): WarehouseSlotData[] {
  const saved = localStorage.getItem("wms_slots");
  if (saved) {
    try {
      const parsed: WarehouseSlotData[] = JSON.parse(saved);
      // Migration check: ensure slots reflect the real 5-tier Bolzano topology and NO N-B table slots
      const hasRealSlots = parsed.some(
        (s) =>
          s.slot_code.startsWith("N-A") ||
          s.slot_code.startsWith("A-") ||
          s.slot_code.startsWith("D-"),
      );
      const hasTableProductSlots = parsed.some((s) =>
        s.slot_code.startsWith("N-B"),
      );
      if (hasRealSlots && !hasTableProductSlots && parsed.length >= 20) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  const defaultSlots = generateBolzanoDefaultSlots(getLocalProducts());
  setLocalSlots(defaultSlots);
  return defaultSlots;
}

function setLocalSlots(slots: WarehouseSlotData[]) {
  localStorage.setItem("wms_slots", JSON.stringify(slots));
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error("API request failed");
    const data = await res.json();
    // Guard against legacy 15-item 3-tier seed in server/db.ts overwriting the full 5-tier Bolzano catalog
    if (
      !Array.isArray(data) ||
      data.length < NORSAN_PRODUCTS.length ||
      data.some((p: any) => /^S[123]-/.test(p.shelf_location || ""))
    ) {
      return getLocalProducts();
    }
    return data.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      italianName: p.italian_name,
      ean: p.ean,
      category: p.category,
      brand: p.brand,
      volume: p.volume,
      packageType: p.package_type,
      shelfLocation: p.shelf_location || "S-C-1",
      shelfCoordinate: p.shelf_location || "S-C-1",
      rackSide: p.rack_side || "S",
      tier: p.tier || 3,
      weightGrams: p.weight_grams,
      imageUrl: p.image_url,
      barcodeText: p.ean,
      fragile: Boolean(p.fragile),
      instructions: p.instructions,
    }));
  } catch (err) {
    console.warn("[WMS API] using localStorage fallback for products");
    return getLocalProducts();
  }
}

export async function fetchWarehouseSlots(): Promise<WarehouseSlotData[]> {
  try {
    const res = await fetch(`${API_BASE}/slots`);
    if (!res.ok) throw new Error("API request failed");
    const data = await res.json();
    // Guard against legacy S1-A..S3-J 3-tier slots from server/db.ts
    if (
      !Array.isArray(data) ||
      data.some((s: any) => /^S[123]-/.test(s.slot_code || ""))
    ) {
      return getLocalSlots();
    }
    return data;
  } catch (err) {
    console.warn("[WMS API] using localStorage fallback for slots");
    return getLocalSlots();
  }
}

export async function updateSlotAssignment(
  slotCode: string,
  productId: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/slotting/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotCode, productId }),
    });
    if (res.ok) return true;
    throw new Error("Backend failed");
  } catch (err) {
    // MVP Fallback: Update localStorage
    console.warn("[WMS API] updateSlotAssignment fallback");
    const slots = getLocalSlots();
    const products = getLocalProducts();
    
    const slotIndex = slots.findIndex(s => s.slot_code === slotCode);
    if (slotIndex >= 0) {
      const prod = products.find(p => p.id === productId);
      slots[slotIndex].product_id = productId;
      slots[slotIndex].product_name = prod ? prod.name : "";
      slots[slotIndex].product_brand = prod ? prod.brand : undefined;
      slots[slotIndex].product_ean = prod ? prod.ean : undefined;
      setLocalSlots(slots);
      
      // Update product's shelf location
      if (prod) {
        const prodIndex = products.findIndex(p => p.id === productId);
        if (prodIndex >= 0) {
          products[prodIndex].shelfLocation = slotCode;
          products[prodIndex].rackSide = slots[slotIndex].side;
          products[prodIndex].tier = slots[slotIndex].tier;
          setLocalProducts(products);
        }
      }
      return true;
    }
    return false;
  }
}

export async function addNewSlot(
  slotCode: string,
  side: "S" | "D",
  tier: 1 | 2 | 3,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/slots/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotCode, side, tier }),
    });
    if (res.ok) return true;
    throw new Error("Backend failed");
  } catch (err) {
    const slots = getLocalSlots();
    if (!slots.some(s => s.slot_code === slotCode)) {
      slots.push({
        slot_code: slotCode,
        side,
        tier,
        description: `Piano ${tier}`,
        product_id: null,
        product_name: ""
      });
      setLocalSlots(slots);
      return true;
    }
    return false;
  }
}

export async function deleteSlot(slotCode: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/slots/${slotCode}`, {
      method: "DELETE",
    });
    if (res.ok) return true;
    throw new Error("Backend failed");
  } catch (err) {
    const slots = getLocalSlots();
    const newSlots = slots.filter(s => s.slot_code !== slotCode);
    setLocalSlots(newSlots);
    
    const products = getLocalProducts();
    let modified = false;
    products.forEach(p => {
      if (p.shelfLocation === slotCode) {
        p.shelfLocation = "S1-A"; // Default fallback
        modified = true;
      }
    });
    if (modified) setLocalProducts(products);
    
    return true;
  }
}

export async function updateProductImageApi(
  productId: string,
  imageUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==========================================
// 100% PRODUCTION READY ORDERS & OPERATORS API
// ==========================================

export async function fetchOrdersApi(): Promise<Order[] | null> {
  try {
    const res = await fetch(`${API_BASE}/orders`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("Orders API failed");
    const data = await res.json();
    if (Array.isArray(data)) return data;
    return null;
  } catch (err) {
    return null;
  }
}

export async function saveBulkOrdersApi(
  orders: Order[],
  replace: boolean = false,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders, replace }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateOrderStatusApi(
  orderId: string,
  status: string,
  operatorId?: string,
  stationId?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, operatorId, stationId }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateOrderItemScannedApi(
  orderId: string,
  productId: string,
  quantityScanned: number,
  status: string = "in_progress",
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/item`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantityScanned, status }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateOrderBoxApi(
  orderId: string,
  boxRecommendation: string,
  boxBranding: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/box`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boxRecommendation, boxBranding }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updatePackageCountApi(
  orderId: string,
  packageCount: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/package-count`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageCount }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteOrderApi(orderId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearPackedOrdersApi(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/orders/clear-packed`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchOperatorsApi(): Promise<Operator[] | null> {
  try {
    const res = await fetch(`${API_BASE}/operators`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("Operators API failed");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch {
    return null;
  }
}

export async function verifyOperatorApi(
  code?: string,
  pin?: string,
): Promise<{ success: boolean; operator?: Operator; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/operators/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, pin }),
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, operator: data.operator };
    }
    return { success: false, error: data.error || "Autenticazione fallita" };
  } catch {
    return { success: false, error: "Server non raggiungibile" };
  }
}

export async function createOperatorApi(operator: Operator): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/operators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operator),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateOperatorApi(operator: Operator): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/operators/${operator.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operator),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteOperatorApi(operatorId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/operators/${operatorId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchInventoryAndLotsApi(): Promise<{
  stock: any[];
  lots: any[];
} | null> {
  try {
    const res = await fetch(`${API_BASE}/inventory`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function upsertInventoryRecordApi(rec: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/inventory/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function upsertLotRecordApi(lot: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/lots/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lot),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
