import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../index";
import { db, initDatabase } from "../db";

describe("Production Readiness: Multi-Bench Locking, Shared Sync & API Outbox", () => {
  let seedProductId = "nor-01";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    initDatabase();
    const res = await request(app).get("/api/products");
    if (Array.isArray(res.body) && res.body.length > 0) {
      seedProductId = res.body[0].id;
    }

    await request(app)
      .post("/api/orders/bulk")
      .send({
        replace: false,
        orders: [
          {
            id: "ord-lock-1",
            orderNumber: "INT90001",
            barcode: "INT90001",
            source: "SellyErp INT",
            customerName: "Mario Rossi",
            customerAddress: "Via Roma 10",
            customerCity: "Bolzano",
            customerZip: "39100",
            customerProvince: "BZ",
            customerCountry: "IT",
            courier: "DHL Express",
            trackingNumber: "JJD0000090001",
            priority: "standard",
            boxRecommendation: "BOX-NOR-S",
            boxBranding: "norsan_logo",
            status: "ready_to_pack",
            marketingFlyers: [
              {
                id: "fly-01",
                code: "FLY-NOR-ITA",
                title: "Guida Omega-3",
                italianTitle: "Guida Omega-3",
                shelfLocation: "D3-C",
                brand: "NORSAN",
                isIncluded: false,
              },
            ],
            items: [{ productId: seedProductId, quantityRequired: 1, quantityScanned: 0 }],
          },
          {
            id: "ord-lock-2",
            orderNumber: "INT90002",
            barcode: "INT90002",
            source: "SellyErp INT",
            customerName: "Giulia Bianchi",
            customerAddress: "Via Milano 5",
            customerCity: "Trento",
            customerZip: "38122",
            customerProvince: "TN",
            customerCountry: "IT",
            courier: "DHL Express",
            trackingNumber: "JJD0000090002",
            priority: "standard",
            boxRecommendation: "BOX-NOR-M",
            boxBranding: "norsan_logo",
            status: "ready_to_pack",
            marketingFlyers: [],
            items: [{ productId: seedProductId, quantityRequired: 2, quantityScanned: 0 }],
          },
        ],
      })
      .expect(200);
  });

  afterAll(() => {
    db.close();
  });

  it("enforces atomic order locking, conflict 409, auto-release on switch, force release, and outbox queue", async () => {
    // 1. op-01 locks ord-lock-1
    const lock1 = await request(app)
      .post("/api/orders/ord-lock-1/lock")
      .send({ operatorId: "op-01", operatorName: "Operatore 01", stationId: "ST-01" });
    expect(lock1.status).toBe(200);
    expect(lock1.body.locked).toBe(true);
    expect(lock1.body.lockedBy.operatorId).toBe("op-01");

    // 2. op-02 tries to lock ord-lock-1 -> 409 Conflict
    const conflict = await request(app)
      .post("/api/orders/ord-lock-1/lock")
      .send({ operatorId: "op-02", operatorName: "Operatore 02", stationId: "ST-02" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.lockedBy.operatorId).toBe("op-01");

    // 3. Non-owner unlock without force -> 403 Forbidden
    const forbidUnlock = await request(app)
      .post("/api/orders/ord-lock-1/unlock")
      .send({ operatorId: "op-02", force: false });
    expect(forbidUnlock.status).toBe(403);

    // 4. op-01 locks ord-lock-2 -> automatically releases ord-lock-1
    const lock2 = await request(app)
      .post("/api/orders/ord-lock-2/lock")
      .send({ operatorId: "op-01", operatorName: "Operatore 01", stationId: "ST-01" });
    expect(lock2.status).toBe(200);

    const ordersAfterSwitch = await request(app).get("/api/orders");
    const o1AfterSwitch = ordersAfterSwitch.body.find((o: any) => o.id === "ord-lock-1");
    const o2AfterSwitch = ordersAfterSwitch.body.find((o: any) => o.id === "ord-lock-2");
    expect(o1AfterSwitch.lockedByOperatorId).toBeNull();
    expect(o2AfterSwitch.lockedByOperatorId).toBe("op-01");

    // 5. Team Lead Force Release unlocks ord-lock-2 held by op-01
    const forceUnlock = await request(app)
      .post("/api/orders/ord-lock-2/unlock")
      .send({ operatorId: "tl-01", force: true });
    expect(forceUnlock.status).toBe(200);

    const ordersAfterForce = await request(app).get("/api/orders");
    expect(ordersAfterForce.body.find((o: any) => o.id === "ord-lock-2").lockedByOperatorId).toBeNull();

    // 6. Packing ord-lock-2 releases any lock and writes to api_outbox
    await request(app)
      .post("/api/orders/ord-lock-2/lock")
      .send({ operatorId: "op-01", operatorName: "Operatore 01", stationId: "ST-01" })
      .expect(200);

    const packedRes = await request(app)
      .patch("/api/orders/ord-lock-2/status")
      .send({ status: "packed", operatorId: "op-01", stationId: "ST-01" });
    expect(packedRes.status).toBe(200);

    const integStatus = await request(app).get("/api/integrations/status");
    expect(integStatus.status).toBe(200);
    expect(integStatus.body.outboxPendingCount).toBeGreaterThanOrEqual(1);
    expect(integStatus.body.dhl.status).toBe("pending_credentials");

    const ordersFinal = await request(app).get("/api/orders");
    expect(ordersFinal.body.find((o: any) => o.id === "ord-lock-2").lockedByOperatorId).toBeNull();
  });

  it("persists checklist toggles and normalized addresses across sync fetches", async () => {
    await request(app)
      .patch("/api/orders/ord-lock-1/checklist")
      .send({
        giftConfirmed: true,
        physicalDocumentConfirmed: true,
        marketingFlyers: [
          {
            id: "fly-01",
            code: "FLY-NOR-ITA",
            title: "Guida Omega-3",
            italianTitle: "Guida Omega-3",
            shelfLocation: "D3-C",
            brand: "NORSAN",
            isIncluded: true,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch("/api/orders/ord-lock-1/address")
      .send({
        customerAddress: "Via Garibaldi 44",
        customerCity: "Bolzano",
        customerZip: "39100",
        customerProvince: "BZ",
        addressStatus: "valid",
        addressDetails: {
          street: "Via Garibaldi",
          houseNumber: "44",
          addressAddition: "Scala B",
          status: "valid",
        },
      })
      .expect(200);

    const res = await request(app).get("/api/orders").expect(200);
    const updated = res.body.find((o: any) => o.id === "ord-lock-1");
    expect(updated.giftConfirmed).toBe(true);
    expect(updated.physicalDocumentConfirmed).toBe(true);
    expect(updated.marketingFlyers[0].isIncluded).toBe(true);
    expect(updated.customerAddress).toBe("Via Garibaldi 44");
    expect(updated.addressDetails?.houseNumber).toBe("44");
    expect(updated.addressStatus).toBe("valid");
  });

  it("persists Kanban replenishment issues and resolves them", async () => {
    const createRes = await request(app)
      .post("/api/issues")
      .send({
        id: "iss-test-1",
        orderNumber: "INT90001",
        stationId: "ST-01",
        operatorName: "Operatore 01",
        type: "Scaffale Vuoto / Rifornimento Kanban",
        note: "Serve cartone Total Limone",
      });
    expect(createRes.status).toBe(200);
    expect(createRes.body.issue.status).toBe("pending");

    const list1 = await request(app).get("/api/issues").expect(200);
    expect(list1.body.some((i: any) => i.id === "iss-test-1" && i.status === "pending")).toBe(true);

    await request(app)
      .patch("/api/issues/iss-test-1/resolve")
      .send({ resolvedBy: "Team Lead 01" })
      .expect(200);

    const list2 = await request(app).get("/api/issues").expect(200);
    expect(list2.body.find((i: any) => i.id === "iss-test-1").status).toBe("resolved");
  });

  it("persists custom barcode bindings across workstations and returns audit summary", async () => {
    await request(app)
      .post("/api/barcode-bindings")
      .send({
        rawBarcode: "8009999888777",
        targetSku: "NOR-TOT-200-LEM",
        boundBy: "OP-01",
      })
      .expect(200);

    const bindRes = await request(app).get("/api/barcode-bindings").expect(200);
    expect(bindRes.body.bindings["8009999888777"]).toBe("NOR-TOT-200-LEM");

    await request(app)
      .post("/api/audit/scan")
      .send({
        operatorCode: "OP-01",
        rawCode: "4260368140025",
        resultType: "wrong_product",
        status: "error",
        message: "Wrong SKU test",
        orderId: "ord-lock-1",
        productId: "nor-02",
      })
      .expect(200);

    const auditSummary = await request(app).get("/api/audit/summary").expect(200);
    expect(auditSummary.body.totalScans).toBeGreaterThanOrEqual(1);
    expect(auditSummary.body.blockedErrors).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(auditSummary.body.topErrors)).toBe(true);
    expect(Array.isArray(auditSummary.body.recentLogs)).toBe(true);
  });

  it("persists consolidated linkedOrderNumbers/linkedBarcodes and fans out api_outbox per linked order", async () => {
    await request(app)
      .post("/api/orders/bulk")
      .send({
        replace: false,
        orders: [
          {
            id: "ord-unified-1",
            orderNumber: "INT55813",
            barcode: "INT55813",
            linkedOrderNumbers: ["INT55813", "IT101778"],
            linkedBarcodes: ["INT55813", "IT101778"],
            source: "Selly ERP Import",
            customerName: "Ester Walker",
            customerAddress: "Via Dott. Alice 15",
            customerCity: "Bolzano",
            customerZip: "39100",
            customerProvince: "BZ",
            customerCountry: "IT",
            courier: "DHL Express",
            trackingNumber: "JJD0000055813",
            priority: "express",
            boxRecommendation: "BOX-NOR-M",
            boxBranding: "norsan_logo",
            status: "ready_to_pack",
            marketingFlyers: [],
            items: [{ productId: seedProductId, quantityRequired: 2, quantityScanned: 0 }],
          },
        ],
      })
      .expect(200);

    const listRes = await request(app).get("/api/orders").expect(200);
    const saved = listRes.body.find((o: any) => o.id === "ord-unified-1");
    expect(saved.linkedOrderNumbers).toEqual(["INT55813", "IT101778"]);
    expect(saved.linkedBarcodes).toEqual(["INT55813", "IT101778"]);

    await request(app)
      .patch("/api/orders/ord-unified-1/status")
      .send({ status: "packed", operatorId: "op-01", stationId: "ST-01" })
      .expect(200);

    const outboxRows = db
      .prepare(
        "SELECT order_id, order_number, tracking_number FROM api_outbox WHERE tracking_number = ?",
      )
      .all("JJD0000055813") as any[];
    expect(outboxRows).toHaveLength(2);
    expect(outboxRows.map((r) => r.order_number).sort()).toEqual(["INT55813", "IT101778"]);
  });
});
