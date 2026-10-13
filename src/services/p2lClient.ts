import { Order } from "../types/wms";

const P2L_API_BASE = "http://localhost:3001/api/p2l";

/**
 * Triggers the Pick-to-Light hardware/mock system
 * Lights up LEDs (GREEN) for all pending items in the active order.
 */
export async function lightActiveOrder(order: Order): Promise<void> {
  const itemsToLight = order.items
    .filter((item) => item.quantityScanned < item.quantityRequired)
    .map((item) => ({
      tier: item.product.p2lTier || "D",
      ledIndex: item.product.p2lLedIndex || 1,
    }));

  if (itemsToLight.length === 0) return;

  try {
    await fetch(`${P2L_API_BASE}/light`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: itemsToLight }),
    });
  } catch {
    // Offline / fallback mode: silently ignore in dev/browser
  }
}

/**
 * Mark a single product LED as scanned (blink green × 2, then turn off)
 */
export async function markProductScanned(
  tier?: string,
  ledIndex?: number
): Promise<void> {
  if (!tier || ledIndex == null) return;

  try {
    await fetch(`${P2L_API_BASE}/scanned`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, ledIndex }),
    });
  } catch {
    // Silent fallback
  }
}

/**
 * Blink red on wrong scan attempt
 */
export async function blinkWrongScan(
  tier?: string,
  ledIndex?: number
): Promise<void> {
  if (!tier || ledIndex == null) return;

  try {
    await fetch(`${P2L_API_BASE}/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, ledIndex }),
    });
  } catch {
    // Silent fallback
  }
}

/**
 * Clear all LEDs when order packing is finished
 */
export async function clearOrderLeds(order: Order): Promise<void> {
  const items = order.items.map((item) => ({
    tier: item.product.p2lTier || "D",
    ledIndex: item.product.p2lLedIndex || 1,
  }));

  try {
    await fetch(`${P2L_API_BASE}/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch {
    // Silent fallback
  }
}
