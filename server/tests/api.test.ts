import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../index";
import { db, initDatabase } from "../db";

describe("WMS Backend API Tests", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    // Initialize the in-memory database schema
    initDatabase();
  });

  afterAll(() => {
    // Close the db after tests
    db.close();
  });

  describe("Product Catalog API", () => {
    it("should fetch all products and ensure NORSAN & ZREEN exist", async () => {
      const res = await request(app).get("/api/products");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      const hasNorsan = res.body.some((p: any) => p.brand === "NORSAN");
      const hasZreen = res.body.some((p: any) => p.brand === "ZREEN");
      expect(hasNorsan).toBe(true);
      expect(hasZreen).toBe(true);
    });

    it("should fetch boxes and flyers", async () => {
      const boxRes = await request(app).get("/api/boxes");
      expect(boxRes.status).toBe(200);
      expect(boxRes.body.length).toBeGreaterThan(0);

      const flyerRes = await request(app).get("/api/flyers");
      expect(flyerRes.status).toBe(200);
      expect(flyerRes.body.length).toBeGreaterThan(0);
    });
  });

  describe("Slotting API", () => {
    const TEST_SLOT = "TEST-SLOT";

    it("should add a new shelf slot", async () => {
      const res = await request(app)
        .post("/api/slots/add")
        .send({ slotCode: TEST_SLOT, side: "S", tier: 2 });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const slots = await request(app).get("/api/slots");
      const found = slots.body.find((s: any) => s.slot_code === TEST_SLOT);
      expect(found).toBeDefined();
    });

    it("should assign a product to a slot", async () => {
      // Find an existing product
      const products = await request(app).get("/api/products");
      const prodId = products.body[0].id;

      const res = await request(app)
        .post("/api/slotting/assign")
        .send({ slotCode: TEST_SLOT, productId: prodId });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the slot was assigned
      const slots = await request(app).get("/api/slots");
      const updatedSlot = slots.body.find((s: any) => s.slot_code === TEST_SLOT);
      expect(updatedSlot.product_id).toBe(prodId);
    });

    it("should delete a slot", async () => {
      const res = await request(app).delete(`/api/slots/${TEST_SLOT}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const slots = await request(app).get("/api/slots");
      const found = slots.body.find((s: any) => s.slot_code === TEST_SLOT);
      expect(found).toBeUndefined();
    });
  });

  describe("Audit & Tracking API", () => {
    it("should log a scan event", async () => {
      const scanData = {
        operatorCode: "TEST-OP",
        rawCode: "123456789",
        resultType: "product_match",
        status: "success",
        message: "Test scan logged",
        orderId: "ORD-123",
        productId: "prod-01"
      };

      const res = await request(app)
        .post("/api/audit/scan")
        .send(scanData);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      

      // We can query the DB directly to verify
      const stmt = db.prepare("SELECT * FROM scan_audit_logs WHERE id = ?");
      const row = stmt.get(1) as any;
      expect(row).toBeDefined();
      expect(row.operator_code).toBe("TEST-OP");
      expect(row.status).toBe("success");
    });
  });

  describe("Pick-to-Light API", () => {
    it("should return P2L connection status", async () => {
      const res = await request(app).get("/api/p2l/status");
      expect(res.status).toBe(200);
      expect(res.body.online).toBeDefined();
    });

    it("should process lighting order items", async () => {
      const orderItems = [
        { product: { id: "prod-01", name: "Omega 3" }, quantityRequired: 2, quantityScanned: 0 }
      ];

      const res = await request(app)
        .post("/api/p2l/light")
        .send({ items: orderItems });
      
      // Since hardware is mocked in the service, it should just return success
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
