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

// --- 2. ORDERS & OPERATORS API ---

// Get all active operators
app.get("/api/operators", (_req, res) => {
  try {
    const ops = db.prepare("SELECT * FROM operators WHERE is_active = 1").all() as any[];
    const mapped = ops.map((o) => ({
      id: o.id,
      operatorCode: o.operator_code,
      name: o.name,
      role: o.role,
      stationId: o.station_id,
      shift: o.shift,
      avatarUrl: o.avatar_url,
      packedToday: o.packed_today,
      accuracy: o.accuracy,
      uph: o.uph,
      errorsPrevented: o.errors_prevented,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify operator login via badge barcode or personal PIN
app.post("/api/operators/verify", (req, res) => {
  const { code, pin } = req.body || {};
  if (!code && !pin) {
    return res.status(400).json({ error: "Codice badge o PIN obbligatorio" });
  }

  const cleanCode = (code || "").toString().trim().toUpperCase();
  const cleanPin = (pin || "").toString().trim();

  try {
    let op: any;
    if (cleanCode && cleanPin) {
      op = db
        .prepare(
          "SELECT * FROM operators WHERE (operator_code = ? OR name LIKE ?) AND pin = ? AND is_active = 1",
        )
        .get(cleanCode, `%${cleanCode}%`, cleanPin);
    } else if (cleanCode) {
      op = db
        .prepare(
          "SELECT * FROM operators WHERE (operator_code = ? OR name LIKE ?) AND is_active = 1",
        )
        .get(cleanCode, `%${cleanCode}%`);
    } else {
      op = db
        .prepare("SELECT * FROM operators WHERE pin = ? AND is_active = 1")
        .get(cleanPin);
    }

    if (!op) {
      return res.status(401).json({
        success: false,
        error: "Credenziali non valide. Badge non riconosciuto.",
      });
    }

    res.json({
      success: true,
      operator: {
        id: op.id,
        operatorCode: op.operator_code,
        name: op.name,
        role: op.role,
        stationId: op.station_id,
        shift: op.shift,
        avatarUrl: op.avatar_url,
        packedToday: op.packed_today,
        accuracy: op.accuracy,
        uph: op.uph,
        errorsPrevented: op.errors_prevented,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new operator in SQLite
app.post("/api/operators", (req, res) => {
  const op = req.body || {};
  if (!op.id || !op.operatorCode || !op.name) {
    return res.status(400).json({ error: "id, operatorCode e name obbligatori" });
  }
  try {
    db.prepare(
      `
      INSERT OR REPLACE INTO operators (
        id, operator_code, pin, name, role, station_id, shift, avatar_url, packed_today, accuracy, uph, errors_prevented, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    ).run(
      op.id,
      String(op.operatorCode).trim().toUpperCase(),
      op.pin || String(op.operatorCode).replace(/[^0-9]/g, "").padStart(4, "0") || "0000",
      op.name,
      op.role || "packer",
      op.stationId || "ST-01",
      op.shift || "Turno Mattina (07:00 - 15:30)",
      op.avatarUrl || "",
      op.packedToday || 0,
      op.accuracy ?? 100.0,
      op.uph || 0.0,
      op.errorsPrevented || 0,
    );
    res.json({ success: true, operator: op });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing operator in SQLite
app.put("/api/operators/:id", (req, res) => {
  const { id } = req.params;
  const op = req.body || {};
  try {
    db.prepare(
      `
      UPDATE operators
      SET operator_code = COALESCE(?, operator_code),
          name = COALESCE(?, name),
          role = COALESCE(?, role),
          station_id = COALESCE(?, station_id),
          shift = COALESCE(?, shift),
          avatar_url = COALESCE(?, avatar_url),
          packed_today = COALESCE(?, packed_today),
          uph = COALESCE(?, uph)
      WHERE id = ?
    `,
    ).run(
      op.operatorCode ? String(op.operatorCode).trim().toUpperCase() : null,
      op.name ?? null,
      op.role ?? null,
      op.stationId ?? null,
      op.shift ?? null,
      op.avatarUrl ?? null,
      typeof op.packedToday === "number" ? op.packedToday : null,
      typeof op.uph === "number" ? op.uph : null,
      id,
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Soft-delete an operator in SQLite
app.delete("/api/operators/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("UPDATE operators SET is_active = 0 WHERE id = ?").run(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all orders from SQLite with nested items & flyers
app.get("/api/orders", (_req, res) => {
  try {
    const ordersRows = db
      .prepare("SELECT * FROM orders ORDER BY created_at DESC")
      .all() as any[];

    if (ordersRows.length === 0) {
      return res.json([]);
    }

    const itemsRows = db
      .prepare(
        `
      SELECT 
        oi.id as order_item_id,
        oi.order_id,
        oi.quantity_required,
        oi.quantity_scanned,
        oi.status as item_status,
        p.*,
        ps.slot_code as shelf_location,
        ws.side as rack_side,
        ws.tier
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_slotting ps ON p.id = ps.product_id
      LEFT JOIN warehouse_slots ws ON ps.slot_code = ws.slot_code
    `,
      )
      .all() as any[];

    const itemsByOrder: Record<string, any[]> = {};
    for (const item of itemsRows) {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push({
        product: {
          id: item.id,
          sku: item.sku,
          name: item.name,
          italianName: item.italian_name,
          ean: item.ean,
          category: item.category,
          brand: item.brand,
          volume: item.volume,
          packageType: item.package_type,
          shelfLocation: item.shelf_location || "S-C-1",
          rackSide: item.rack_side || "S",
          tier: item.tier || 3,
          weightGrams: item.weight_grams,
          imageUrl: item.image_url,
          barcodeText: item.ean,
          fragile: Boolean(item.fragile),
          instructions: item.instructions,
        },
        quantityRequired: item.quantity_required,
        quantityScanned: item.quantity_scanned,
        status: item.item_status,
      });
    }

    const orders = ordersRows.map((o) => {
      let flyers: any[] = [];
      try {
        flyers = JSON.parse(o.marketing_flyers_json || "[]");
      } catch {
        flyers = [];
      }

      return {
        id: o.id,
        orderNumber: o.order_number,
        barcode: o.barcode || o.order_number,
        source: o.source,
        createdAt: o.created_at,
        customerName: o.customer_name,
        customerAddress: o.customer_address,
        customerCity: o.customer_city,
        customerZip: o.customer_zip,
        customerProvince: o.customer_province,
        customerCountry: o.customer_country,
        courier: o.courier,
        trackingNumber: o.tracking_number,
        priority: o.priority,
        boxBranding: o.box_branding,
        boxRecommendation: o.box_recommendation,
        items: itemsByOrder[o.id] || [],
        marketingFlyers: flyers,
        status: o.status,
        specialNotes: o.special_notes,
        isSubscription: Boolean(o.is_subscription),
        subscriptionCycle: o.subscription_cycle || 1,
        customerOrderCount: 1,
        retentionGift: o.retention_gift || "none",
        giftConfirmed: Boolean(o.gift_confirmed),
        requiresPhysicalDocument: Boolean(o.requires_physical_doc),
        physicalDocumentConfirmed: Boolean(o.physical_doc_confirmed),
        packageCount: o.package_count || 1,
      };
    });

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import bulk orders (e.g. from Selly ERP or CSV upload)
app.post("/api/orders/bulk", (req, res) => {
  const { orders, replace } = req.body || {};
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: "Array ordini obbligatorio" });
  }

  try {
    const insertTx = db.transaction(() => {
      if (replace) {
        db.prepare("DELETE FROM order_items").run();
        db.prepare("DELETE FROM orders").run();
      }

      const insertOrder = db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, order_number, barcode, source, customer_name, customer_address,
          customer_city, customer_zip, customer_province, customer_country,
          courier, tracking_number, priority, box_recommendation, box_branding,
          status, special_notes, created_at, is_subscription, subscription_cycle,
          retention_gift, requires_physical_doc, gift_confirmed, physical_doc_confirmed,
          marketing_flyers_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const insertItem = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, quantity_required, quantity_scanned, status
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const ord of orders) {
        insertOrder.run(
          ord.id,
          ord.orderNumber,
          ord.barcode || ord.orderNumber,
          ord.source || "Selly ERP",
          ord.customerName,
          ord.customerAddress || "",
          ord.customerCity || "",
          ord.customerZip || "",
          ord.customerProvince || "",
          ord.customerCountry || "IT",
          ord.courier || "DHL Paket",
          ord.trackingNumber || `DHL-${ord.orderNumber}`,
          ord.priority || "standard",
          ord.boxRecommendation || "BOX-NOR-S",
          ord.boxBranding || "norsan_logo",
          ord.status || "ready_to_pack",
          ord.specialNotes || null,
          ord.createdAt || Date.now(),
          ord.isSubscription ? 1 : 0,
          ord.subscriptionCycle || 1,
          ord.retentionGift || "none",
          ord.requiresPhysicalDocument ? 1 : 0,
          ord.giftConfirmed ? 1 : 0,
          ord.physicalDocumentConfirmed ? 1 : 0,
          JSON.stringify(ord.marketingFlyers || []),
        );

        // Delete existing items if replacing this order
        db.prepare("DELETE FROM order_items WHERE order_id = ?").run(ord.id);

        if (Array.isArray(ord.items)) {
          for (const it of ord.items) {
            const pId = it.product?.id || it.productId;
            if (pId) {
              insertItem.run(
                ord.id,
                pId,
                it.quantityRequired || 1,
                it.quantityScanned || 0,
                it.status || "pending",
              );
            }
          }
        }
      }
    });

    insertTx();
    res.json({ success: true, count: orders.length });
  } catch (err: any) {
    console.error("[Orders Bulk API Error]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update order status (packing, packed, shipped) with automatic shelf stock deduction & operator stats update
app.patch("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, operatorId, stationId } = req.body || {};
  if (!status) {
    return res.status(400).json({ error: "Status obbligatorio" });
  }

  try {
    const existing = db
      .prepare("SELECT status FROM orders WHERE id = ?")
      .get(id) as { status: string } | undefined;

    const tx = db.transaction(() => {
      if (stationId && status === "packing") {
        db.prepare(
          "UPDATE orders SET status = ?, assigned_station_id = ? WHERE id = ?",
        ).run(status, stationId, id);
      } else {
        db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
      }

      // If transitioning to 'packed' for the first time, deduct shelf stock & increment operator packed_today
      if (status === "packed" && existing && existing.status !== "packed") {
        const items = db
          .prepare(
            `
            SELECT oi.quantity_required, p.sku
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
          `,
          )
          .all(id) as { quantity_required: number; sku: string }[];

        for (const item of items) {
          db.prepare(
            `
            UPDATE inventory_stock
            SET open_units_on_packing_shelf = MAX(0, open_units_on_packing_shelf - ?),
                erp_expected_total_units = MAX(0, erp_expected_total_units - ?)
            WHERE sku = ?
          `,
          ).run(item.quantity_required, item.quantity_required, item.sku);
        }

        if (operatorId) {
          db.prepare(
            `
            UPDATE operators
            SET packed_today = packed_today + 1
            WHERE id = ? OR operator_code = ?
          `,
          ).run(operatorId, operatorId);
        }
      }
    });

    tx();
    res.json({ success: true, id, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVENTORY & FEFO LOTS MULTI-STATION SYNC API ---

app.get("/api/inventory", (_req, res) => {
  try {
    const stock = db.prepare("SELECT * FROM inventory_stock").all();
    const lots = db.prepare("SELECT * FROM product_lots").all();
    res.json({ stock, lots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/upsert", (req, res) => {
  const rec = req.body || {};
  if (!rec.sku) {
    return res.status(400).json({ error: "sku obbligatorio" });
  }
  try {
    db.prepare(
      `
      INSERT OR REPLACE INTO inventory_stock (
        sku, pallet_zone, units_per_carton, closed_cartons_on_pallet,
        open_units_on_packing_shelf, erp_expected_total_units,
        monthly_sales_velocity, unit_cost_eur, last_counted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      rec.sku,
      rec.palletZone || "PALLET-01",
      rec.unitsPerCarton ?? 20,
      rec.closedCartonsOnPallet ?? 0,
      rec.openUnitsOnPackingShelf ?? 0,
      rec.erpExpectedTotalUnits ?? 0,
      rec.monthlySalesVelocity ?? 0,
      rec.unitCostEur ?? 25.0,
      rec.lastCountedAt || "Adesso",
    );
    res.json({ success: true, sku: rec.sku });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/lots/upsert", (req, res) => {
  const lot = req.body || {};
  if (!lot.sku) {
    return res.status(400).json({ error: "sku obbligatorio" });
  }
  try {
    db.prepare(
      `
      INSERT OR REPLACE INTO product_lots (
        sku, lot_number, expiry_date, secondary_lot_number,
        secondary_expiry_date, fefo_status, fefo_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      lot.sku,
      lot.lotNumber || "NON ASSEGNATO",
      lot.expiryDate || "--/----",
      lot.secondaryLot?.lotNumber || null,
      lot.secondaryLot?.expiryDate || null,
      lot.fefoStatus || "optimal",
      lot.fefoNote || null,
    );
    res.json({ success: true, sku: lot.sku });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update scanned quantity for an item in an order
app.patch("/api/orders/:id/item", (req, res) => {
  const { id } = req.params;
  const { productId, quantityScanned, status } = req.body || {};

  if (!productId || typeof quantityScanned !== "number") {
    return res.status(400).json({ error: "productId e quantityScanned obbligatori" });
  }

  try {
    db.prepare(
      `
      UPDATE order_items 
      SET quantity_scanned = ?, status = ?
      WHERE order_id = ? AND product_id = ?
    `,
    ).run(quantityScanned, status || "in_progress", id, productId);

    res.json({ success: true, id, productId, quantityScanned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update box type and branding
app.patch("/api/orders/:id/box", (req, res) => {
  const { id } = req.params;
  const { boxRecommendation, boxBranding } = req.body || {};

  try {
    db.prepare(
      `
      UPDATE orders 
      SET box_recommendation = ?, box_branding = ?
      WHERE id = ?
    `,
    ).run(boxRecommendation, boxBranding, id);

    res.json({ success: true, id, boxRecommendation, boxBranding });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update order package count (multi-collo / colli counter)
app.patch("/api/orders/:id/package-count", (req, res) => {
  const { id } = req.params;
  const { packageCount } = req.body || {};

  try {
    const validCount = Math.max(1, Number(packageCount) || 1);
    db.prepare("UPDATE orders SET package_count = ? WHERE id = ?").run(validCount, id);
    res.json({ success: true, id, packageCount: validCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an order
app.delete("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear packed orders
app.post("/api/orders/clear-packed", (_req, res) => {
  try {
    const packed = db
      .prepare("SELECT id FROM orders WHERE status = 'packed' OR status = 'shipped'")
      .all() as { id: string }[];

    const tx = db.transaction(() => {
      for (const o of packed) {
        db.prepare("DELETE FROM order_items WHERE order_id = ?").run(o.id);
        db.prepare("DELETE FROM orders WHERE id = ?").run(o.id);
      }
    });
    tx();

    res.json({ success: true, clearedCount: packed.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Boxes and Flyers metadata
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
