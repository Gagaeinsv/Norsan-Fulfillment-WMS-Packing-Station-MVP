import { Product } from "../types/wms";
import { WarehouseSlotData } from "../components/supervisor/SlottingManager";
import { NORSAN_PRODUCTS } from "../data/norsanProducts";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `http://${window.location.hostname}:3001/api`;

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
    console.error("[WMS API] fetchProducts error:", err);
    // Fallback to local catalog if server is starting
    return NORSAN_PRODUCTS;
  }
}

export async function fetchWarehouseSlots(): Promise<WarehouseSlotData[]> {
  try {
    const res = await fetch(`${API_BASE}/slots`);
    if (!res.ok) throw new Error("API request failed");
    return await res.json();
  } catch (err) {
    console.error("[WMS API] fetchProducts error:", err);
    // Default fallback
    return [
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
    return res.ok;
  } catch (err) {
    console.error("[WMS API] fetchProducts error:", err);
    return false;
  }
}

export async function addNewSlot(
  slotCode: string,
  side: "S" | "D",
  tier: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/slots/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotCode, side, tier }),
    });
    return res.ok;
  } catch (err) {
    console.error("[WMS API] fetchProducts error:", err);
    return false;
  }
}

export async function deleteSlot(slotCode: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/slots/${slotCode}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.error("[WMS API] fetchProducts error:", err);
    return false;
  }
}
