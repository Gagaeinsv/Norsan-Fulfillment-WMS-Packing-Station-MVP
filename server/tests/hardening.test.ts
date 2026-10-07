import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";
import { db, initDatabase } from "../db";

const slotsOf = async () => (await request(app).get("/api/slots")).body as any[];

describe("Slotting: persistenza dopo riavvio (bug: perdita dati)", () => {
  it("uno slot eliminato non ricompare e le assegnazioni restano dopo un riavvio", async () => {
    const before = await slotsOf();
    expect(before.length).toBe(60);
    const s2a = before.find((s) => s.slot_code === "S2-A");
    expect(s2a.product_id).toBe("nor-01");

    // Il Team Lead elimina uno slot e ne riassegna un altro
    expect((await request(app).delete("/api/slots/S1-J")).status).toBe(200);
    await request(app)
      .post("/api/slotting/assign")
      .send({ slotCode: "S2-A", productId: "nor-02" });

    // Simula il riavvio del server
    initDatabase();

    const after = await slotsOf();
    expect(after.find((s) => s.slot_code === "S1-J")).toBeUndefined();
    expect(after.length).toBe(59);
    expect(after.find((s) => s.slot_code === "S2-A").product_id).toBe("nor-02");
  });
});

describe("Slotting: validazione e errori", () => {
  it("rifiuta lato o piano non validi (400)", async () => {
    const r1 = await request(app).post("/api/slots/add").send({ slotCode: "X1", side: "Z", tier: 2 });
    const r2 = await request(app).post("/api/slots/add").send({ slotCode: "X1", side: "S", tier: 9 });
    const r3 = await request(app).post("/api/slots/add").send({ slotCode: "bad code!", side: "S", tier: 2 });
    expect([r1.status, r2.status, r3.status]).toEqual([400, 400, 400]);
  });

  it("non sovrascrive uno slot esistente (409) e non perde l'assegnazione", async () => {
    const res = await request(app).post("/api/slots/add").send({ slotCode: "D2-A", side: "D", tier: 2 });
    expect(res.status).toBe(409);
    const slot = (await slotsOf()).find((s) => s.slot_code === "D2-A");
    expect(slot.product_id).toBe("nor-06");
  });

  it("assegnazione a slot o prodotto inesistente restituisce 404, non 500", async () => {
    const a = await request(app).post("/api/slotting/assign").send({ slotCode: "NOPE", productId: "nor-01" });
    const b = await request(app).post("/api/slotting/assign").send({ slotCode: "S1-C", productId: "nope" });
    expect([a.status, b.status]).toEqual([404, 404]);
  });

  it("eliminare uno slot inesistente restituisce 404", async () => {
    expect((await request(app).delete("/api/slots/NOPE")).status).toBe(404);
  });

  it("POST senza corpo JSON restituisce 400, non 500", async () => {
    const res = await request(app).post("/api/slotting/assign");
    expect(res.status).toBe(400);
  });

  it("JSON malformato restituisce 400 in formato JSON, senza stack trace", async () => {
    const res = await request(app)
      .post("/api/slotting/assign")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at \w+/);
  });
});

describe("Audit: validazione", () => {
  it("campi obbligatori mancanti restituiscono 400 e non scrivono nulla", async () => {
    const n0 = (db.prepare("SELECT COUNT(*) c FROM scan_audit_logs").get() as any).c;
    const res = await request(app).post("/api/audit/scan").send({ rawCode: "123" });
    expect(res.status).toBe(400);
    const n1 = (db.prepare("SELECT COUNT(*) c FROM scan_audit_logs").get() as any).c;
    expect(n1).toBe(n0);
  });

  it("restituisce logId e registra il record", async () => {
    const res = await request(app).post("/api/audit/scan").send({
      operatorCode: "OP-1", rawCode: "4260368140018", resultType: "product_match", status: "success", message: "ok",
    });
    expect(res.status).toBe(200);
    expect(res.body.logId).toBeGreaterThan(0);
    const row = db.prepare("SELECT * FROM scan_audit_logs WHERE id = ?").get(res.body.logId) as any;
    expect(row.operator_code).toBe("OP-1");
  });

  it("rifiuta testi eccessivamente lunghi (400)", async () => {
    const res = await request(app).post("/api/audit/scan").send({
      operatorCode: "OP-1", rawCode: "x".repeat(5000), resultType: "t", status: "s", message: "m",
    });
    expect(res.status).toBe(400);
  });
});

describe("Pick-to-Light: validazione", () => {
  it("scanned/error con tier o ledIndex non validi restituiscono 400", async () => {
    const a = await request(app).post("/api/p2l/scanned").send({ tier: "Z", ledIndex: 1 });
    const b = await request(app).post("/api/p2l/error").send({ tier: "A", ledIndex: -3 });
    const c = await request(app).post("/api/p2l/scanned").send({ tier: "A", ledIndex: "abc" });
    expect([a.status, b.status, c.status]).toEqual([400, 400, 400]);
  });

  it("la risposta indica se i LED sono stati realmente accesi (controller offline = mock)", async () => {
    const res = await request(app).post("/api/p2l/light").send({ items: [{ tier: "A", ledIndex: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.sent).toBe(0);
    expect(res.body.mock).toBe(true);
  });
});

describe("Salute del servizio", () => {
  it("GET /api/health risponde ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
