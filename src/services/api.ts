import { Product } from "../types/wms";
import { WarehouseSlotData } from "../components/supervisor/SlottingManager";
import { NORSAN_PRODUCTS } from "../data/norsanProducts";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `http://${window.location.hostname}:3001/api`;

const DEFAULT_SLOTS: WarehouseSlotData[] = [
  {
    slot_code: "S3-A",
    side: "S",
    tier: 3,
    description: "Piano 3",
    product_id: "prod-03",
    product_name: "NORSAN Omega-3 Arktis",
    product_brand: "NORSAN",
    product_ean: "4260368140032",
  },
  {
    slot_code: "S2-A",
    side: "S",
    tier: 2,
    description: "Piano 2",
    product_id: "prod-01",
    product_name: "NORSAN Omega-3 Total (Limone)",
    product_brand: "NORSAN",
    product_ean: "4260368140018",
  },
  {
    slot_code: "S2-C",
    side: "S",
    tier: 2,
    description: "Piano 2",
    product_id: "prod-11",
    product_name: "ZREEN Collagene Idrolizzato",
    product_brand: "ZREEN",
    product_ean: "4260368140220",
  },
  {
    slot_code: "D2-A",
    side: "D",
    tier: 2,
    description: "Piano 2",
    product_id: "prod-06",
    product_name: "NORSAN Omega-3 Total Capsule",
    product_brand: "NORSAN",
    product_ean: "4260368140063",
  },
  {
    slot_code: "D2-C",
    side: "D",
    tier: 2,
    description: "Piano 2",
    product_id: "prod-12",
    product_name: "ZREEN Ashwagandha KSM-66",
    product_brand: "ZREEN",
    product_ean: "4260368140213",
  },
  {
    slot_code: "D3-C",
    side: "D",
    tier: 3,
    description: "Piano 3",
    product_id: null,
    product_name: "Volantini Pubblicitari",
  },
];

// LocalStorage helpers for MVP frontend-only mode
function getLocalProducts(): Product[] {
  const saved = localStorage.getItem("wms_products");
  if (!saved) return NORSAN_PRODUCTS;
  try {
    const parsed: Product[] = JSON.parse(saved);
    return NORSAN_PRODUCTS.map((prod) => {
      const savedProd = parsed.find(
        (p) => p.id === prod.id || p.sku === prod.sku
      );
      if (!savedProd) return prod;
      return {
        ...prod,
        ...savedProd,
        aliases: Array.from(
          new Set([...(prod.aliases || []), ...(savedProd.aliases || [])])
        ),
      };
    });
  } catch {
    return NORSAN_PRODUCTS;
  }
}
function setLocalProducts(products: Product[]) {
  localStorage.setItem("wms_products", JSON.stringify(products));
}
function getLocalSlots(): WarehouseSlotData[] {
  const saved = localStorage.getItem("wms_slots");
  return saved ? JSON.parse(saved) : DEFAULT_SLOTS;
}
function setLocalSlots(slots: WarehouseSlotData[]) {
  localStorage.setItem("wms_slots", JSON.stringify(slots));
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error("API request failed");
    const data = await res.json();
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
      shelfLocation: p.shelf_location || "S1-A",
      rackSide: p.rack_side || "S",
      tier: p.tier || 1,
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
    return await res.json();
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
