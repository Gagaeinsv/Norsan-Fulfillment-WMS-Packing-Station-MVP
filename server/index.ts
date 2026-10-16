import express from "express";
import cors from "cors";
import { db, initDatabase } from "./db";
import {
  lightOrderItems,
  markItemScanned,
  blinkError,
  clearAllLeds,
  getP2lStatus,
} from "./services/p2lService";

export const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
initDatabase();

// --- 1. PRODUCTS & DYNAMIC SLOTTING API ---

// Get all products with their currently assigned shelf location
app.get("/api/products", (_req, res) => {
  const query = `
    SELECT 
      p.*,
      ps.slot_code as shelf_location,
      ws.side as rack_side,
      ws.tier
    FROM products p
    LEFT JOIN product_slotting ps ON p.id = ps.product_id
    LEFT JOIN warehouse_slots ws ON ps.slot_code = ws.slot_code
    ORDER BY p.brand DESC, p.name ASC
  `;
  const products = db.prepare(query).all();
  res.json(products);
});

// Get all slots with assigned products
app.get("/api/slots", (_req, res) => {
  const query = `
    SELECT 
      ws.slot_code,
      ws.side,
      ws.tier,
      ws.description,
      p.id as product_id,
      p.name as product_name,
      p.italian_name as product_italian_name,
      p.ean as product_ean,
      p.brand as product_brand,
      p.volume as product_volume,
      p.category as product_category,
      p.image_url as product_image_url
    FROM warehouse_slots ws
    LEFT JOIN product_slotting ps ON ws.slot_code = ps.slot_code
    LEFT JOIN products p ON ps.product_id = p.id
    ORDER BY ws.side ASC, ws.tier DESC, ws.slot_code ASC
  `;
  const slots = db.prepare(query).all();
  res.json(slots);
});

// Dynamic Reassignment of Slotting (5S Rack Slotting Configurator)
app.post("/api/slotting/assign", (req, res) => {
  const { slotCode, productId } = req.body || {};

  if (!slotCode || typeof slotCode !== "string") {
    return res.status(400).json({ error: "slotCode is required" });
  }

  try {
    const slotExists = db
      .prepare("SELECT 1 FROM warehouse_slots WHERE slot_code = ?")
      .get(slotCode);
    if (!slotExists) {
      return res.status(404).json({ error: `Slot ${slotCode} non trovato` });
    }

    if (productId) {
      const prodExists = db
        .prepare("SELECT 1 FROM products WHERE id = ?")
        .get(productId);
      if (!prodExists) {
        return res
          .status(404)
          .json({ error: `Prodotto ${productId} non trovato` });
      }
    }

    const assignTx = db.transaction(() => {
      db.prepare("DELETE FROM product_slotting WHERE slot_code = ?").run(
        slotCode,
      );
      if (productId) {
        db.prepare("DELETE FROM product_slotting WHERE product_id = ?").run(
          productId,
        );
        db.prepare(
          "INSERT INTO product_slotting (slot_code, product_id) VALUES (?, ?)",
        ).run(slotCode, productId);
      }
    });
    assignTx();
    res.json({ success: true, slotCode, productId });
  } catch (err: any) {
    console.error("[DB] Slot assignment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a new slot to a shelf tier
app.post("/api/slots/add", (req, res) => {
  const { slotCode, side, tier, description } = req.body || {};
  if (
    !slotCode ||
    typeof slotCode !== "string" ||
    !/^[A-Za-z0-9_-]{1,20}$/.test(slotCode) ||
    (side !== "S" && side !== "D") ||
    typeof tier !== "number" ||
    !Number.isInteger(tier) ||
    tier < 1 ||
    tier > 5
  ) {
    return res
      .status(400)
      .json({ error: "Parametri slotCode, side (S|D) o tier (1..5) non validi" });
  }

  try {
    const existing = db
      .prepare("SELECT 1 FROM warehouse_slots WHERE slot_code = ?")
      .get(slotCode);
    if (existing) {
      return res.status(409).json({ error: `Lo slot ${slotCode} esiste già` });
    }

    db.prepare(
      `
      INSERT INTO warehouse_slots (slot_code, side, tier, position_index, description)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(position_index), 0) + 1 FROM warehouse_slots WHERE side = ? AND tier = ?), ?)
    `,
    ).run(
      slotCode,
      side,
      tier,
      side,
      tier,
      description || `Scaffale ${side} • Piano ${tier} • Slot ${slotCode}`,
    );
    res.json({ success: true, slotCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a slot from a shelf tier
app.delete("/api/slots/:slotCode", (req, res) => {
  const { slotCode } = req.params;
  if (!slotCode) {
    return res.status(400).json({ error: "slotCode is required" });
  }

  try {
    const existing = db
      .prepare("SELECT 1 FROM warehouse_slots WHERE slot_code = ?")
      .get(slotCode);
    if (!existing) {
      return res.status(404).json({ error: `Slot ${slotCode} non trovato` });
    }

    db.prepare("DELETE FROM product_slotting WHERE slot_code = ?").run(
      slotCode,
    );
    db.prepare("DELETE FROM warehouse_slots WHERE slot_code = ?").run(slotCode);
    res.json({ success: true, slotCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. ORDERS API ---

app.get("/api/boxes", (_req, res) => {
  const boxes = db.prepare("SELECT * FROM boxes").all();
  res.json(boxes);
});

app.get("/api/flyers", (_req, res) => {
  const flyers = db.prepare("SELECT * FROM marketing_flyers").all();
  res.json(flyers);
});

// Record operator scan audit log
app.post("/api/audit/scan", (req, res) => {
  const {
    operatorCode,
    rawCode,
    resultType,
    status,
    message,
    orderId,
    productId,
  } = req.body || {};

  const requiredStrings = [operatorCode, rawCode, resultType, status, message];
  if (
    requiredStrings.some(
      (v) => typeof v !== "string" || v.trim().length === 0 || v.length > 1000,
    )
  ) {
    return res
      .status(400)
      .json({ error: "Campi audit obbligatori mancanti o troppo lunghi" });
  }

  const insert = db.prepare(`
    INSERT INTO scan_audit_logs (operator_code, raw_code, result_type, status, message, order_id, product_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run(
    operatorCode,
    rawCode,
    resultType,
    status,
    message,
    orderId || null,
    productId || null,
    Date.now(),
  );
  res.json({ success: true, logId: Number(info.lastInsertRowid) });
});

// --- 3. PICK-TO-LIGHT API ---

const VALID_P2L_TIERS = new Set(["A", "B", "C", "D"]);
function isValidP2lItem(tier: unknown, ledIndex: unknown): boolean {
  return (
    typeof tier === "string" &&
    VALID_P2L_TIERS.has(tier) &&
    typeof ledIndex === "number" &&
    Number.isInteger(ledIndex) &&
    ledIndex >= 0 &&
    ledIndex <= 500
  );
}

// GET /api/p2l/status — Health check for ESP32 controller
app.get("/api/p2l/status", (_req, res) => {
  res.json(getP2lStatus());
});

// POST /api/p2l/light — Light up LEDs for open order items (GREEN)
app.post("/api/p2l/light", async (req, res) => {
  const { items } = (req.body || {}) as {
    items?: Array<{ tier?: string; ledIndex?: number }>;
  };
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "items array required" });
  }
  const result = await lightOrderItems(items as any);
  res.json({ success: true, ...result });
});

// POST /api/p2l/scanned — Mark item LED as scanned (blink green × 2, then off)
app.post("/api/p2l/scanned", async (req, res) => {
  const { tier, ledIndex } = (req.body || {}) as {
    tier?: string;
    ledIndex?: number;
  };
  if (!isValidP2lItem(tier, ledIndex)) {
    return res.status(400).json({ error: "tier (A..D) and valid ledIndex required" });
  }
  const result = await markItemScanned(tier as any, ledIndex!);
  res.json({ success: true, ...result });
});

// POST /api/p2l/error — Blink LED red × 2 (wrong scan feedback)
app.post("/api/p2l/error", async (req, res) => {
  const { tier, ledIndex } = (req.body || {}) as {
    tier?: string;
    ledIndex?: number;
  };
  if (!isValidP2lItem(tier, ledIndex)) {
    return res.status(400).json({ error: "tier (A..D) and valid ledIndex required" });
  }
  const result = await blinkError(tier as any, ledIndex!);
  res.json({ success: true, ...result });
});

// POST /api/p2l/clear — Turn off all LEDs for completed order
app.post("/api/p2l/clear", async (req, res) => {
  const { items } = (req.body || {}) as {
    items?: Array<{ tier?: string; ledIndex?: number }>;
  };
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "items array required" });
  }
  const result = await clearAllLeds(items as any);
  res.json({ success: true, ...result });
});

// --- 4. SELLY DIRECT SYNC DAEMON API ---

import {
  getSellySyncConfig,
  updateSellySyncConfig,
  fetchNewOrdersFromSelly,
} from "./services/sellySyncService";

// GET /api/selly/config — Get current sync settings
app.get("/api/selly/config", (_req, res) => {
  res.json(getSellySyncConfig());
});

// POST /api/selly/config — Update API key, URL or auto-sync interval
app.post("/api/selly/config", (req, res) => {
  const updated = updateSellySyncConfig(req.body || {});
  res.json({ success: true, config: updated });
});

// POST /api/selly/sync-now — Trigger manual instant sync from Selly ERP
app.post("/api/selly/sync-now", async (_req, res) => {
  const result = await fetchNewOrdersFromSelly();
  res.json(result);
});

// GET /api/health — Service health endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Global JSON parse / unhandled error middleware (prevents stack trace leaks)
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
      return res.status(400).json({ error: "JSON non valido nel corpo della richiesta" });
    }
    if (err) {
      return res.status(500).json({ error: "Errore interno del server" });
    }
    next();
  },
);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`⚡ WMS Backend Server running on http://localhost:${PORT}`);
  });
}
