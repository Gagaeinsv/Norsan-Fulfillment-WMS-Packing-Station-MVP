import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";

let fake: http.Server;
let ledRequests: any[] = [];
let pingCount = 0;
let lightOrderItems: typeof import("../services/p2lService").lightOrderItems;
let refreshP2lStatus: typeof import("../services/p2lService").refreshP2lStatus;

beforeAll(async () => {
  fake = http.createServer((req, res) => {
    if (req.url === "/ping") {
      pingCount++;
      // risposta lenta: simula la latenza reale del controller
      setTimeout(() => res.writeHead(200).end("pong"), 60);
      return;
    }
    if (req.url === "/led" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        ledRequests.push(JSON.parse(body));
        res.writeHead(200).end("ok");
      });
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  process.env.ESP32_IP = "127.0.0.1";
  process.env.ESP32_PORT = String((fake.address() as AddressInfo).port);
  process.env.P2L_TIMEOUT_MS = "1500";
  const svc = await import("../services/p2lService");
  lightOrderItems = svc.lightOrderItems;
  refreshP2lStatus = svc.refreshP2lStatus;
});

afterAll(() => new Promise<void>((r) => fake.close(() => r())));

describe("Pick-to-Light con controller simulato", () => {
  it("al primo comando accende TUTTI i LED richiesti (nessuna corsa sul ping)", async () => {
    const items = [
      { tier: "A" as const, ledIndex: 1 },
      { tier: "B" as const, ledIndex: 2 },
      { tier: "C" as const, ledIndex: 3 },
    ];
    const result = await lightOrderItems(items);
    expect(ledRequests.length).toBe(3);
    expect(result.sent).toBe(3);
    expect(result.total).toBe(3);
    expect(result.mock).toBe(false);
    // un solo ping condiviso, non uno per ogni comando
    expect(pingCount).toBe(1);
  });

  it("lo stato riflette il controller reale (online) dopo il controllo", async () => {
    const status = await refreshP2lStatus();
    expect(status.online).toBe(true);
  });
});
