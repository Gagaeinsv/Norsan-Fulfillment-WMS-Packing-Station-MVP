import express from 'express';
import cors from 'cors';
import { db, initDatabase } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
initDatabase();

// --- 1. PRODUCTS & DYNAMIC SLOTTING API ---

// Get all products with their currently assigned shelf location
app.get('/api/products', (_req, res) => {
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
app.get('/api/slots', (_req, res) => {
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
app.post('/api/slotting/assign', (req, res) => {
  const { slotCode, productId } = req.body;

  if (!slotCode) {
    return res.status(400).json({ error: 'slotCode is required' });
  }

  try {
    const assignTx = db.transaction(() => {
      db.prepare('DELETE FROM product_slotting WHERE slot_code = ?').run(slotCode);
      if (productId) {
        db.prepare('DELETE FROM product_slotting WHERE product_id = ?').run(productId);
        db.prepare('INSERT INTO product_slotting (slot_code, product_id) VALUES (?, ?)').run(slotCode, productId);
      }
    });
    assignTx();
    res.json({ success: true, slotCode, productId });
  } catch (err: any) {
    console.error('[DB] Slot assignment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a new slot to a shelf tier
app.post('/api/slots/add', (req, res) => {
  const { slotCode, side, tier, description } = req.body;
  if (!slotCode || !side || !tier) {
    return res.status(400).json({ error: 'slotCode, side, and tier are required' });
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO warehouse_slots (slot_code, side, tier, position_index, description)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(position_index), 0) + 1 FROM warehouse_slots WHERE side = ? AND tier = ?), ?)
    `).run(slotCode, side, tier, side, tier, description || `Scaffale ${side} • Piano ${tier} • Slot ${slotCode}`);
    res.json({ success: true, slotCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a slot from a shelf tier
app.delete('/api/slots/:slotCode', (req, res) => {
  const { slotCode } = req.params;
  if (!slotCode) {
    return res.status(400).json({ error: 'slotCode is required' });
  }

  try {
    db.prepare('DELETE FROM product_slotting WHERE slot_code = ?').run(slotCode);
    db.prepare('DELETE FROM warehouse_slots WHERE slot_code = ?').run(slotCode);
    res.json({ success: true, slotCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. ORDERS API ---

app.get('/api/boxes', (_req, res) => {
  const boxes = db.prepare('SELECT * FROM boxes').all();
  res.json(boxes);
});

app.get('/api/flyers', (_req, res) => {
  const flyers = db.prepare('SELECT * FROM marketing_flyers').all();
  res.json(flyers);
});

// Record operator scan audit log
app.post('/api/audit/scan', (req, res) => {
  const { operatorCode, rawCode, resultType, status, message, orderId, productId } = req.body;
  const insert = db.prepare(`
    INSERT INTO scan_audit_logs (operator_code, raw_code, result_type, status, message, order_id, product_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(operatorCode, rawCode, resultType, status, message, orderId || null, productId || null, Date.now());
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`⚡ WMS Backend Server running on http://localhost:${PORT}`);
});
