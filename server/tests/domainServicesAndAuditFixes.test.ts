import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";
import {
  encodeCode128B,
  generateCode128SvgMarkup,
  getCode128Bars,
} from "../../src/services/barcodeGenerator";
import {
  parseItalianAddress,
  parseFullAddressBlock,
  areItalianAddressesMatching,
} from "../../src/services/italianAddressParser";
import {
  parseSellyOrdersCsv,
  matchCatalogProduct,
} from "../../src/services/sellyCsvImporter";
import { NORSAN_PRODUCTS } from "../../src/data/norsanProducts";
import {
  getProductLotInfo,
  updateProductLotInfo,
  rotateToSecondaryLot,
  computeFefoStatus,
} from "../../src/services/lotTraceabilityService";
import {
  getWarehouseInventory,
  recordPhysicalCount,
  transferCartonsToPackingShelf,
  receiveInboundPallet,
} from "../../src/services/mainWarehouseInventoryService";

describe("Code 128-B Barcode Generator (Hardware Scanner Compliance)", () => {
  it("encodes Start Code B (104), valid modulo-103 checksum, and Stop Code (106)", () => {
    const codes = encodeCode128B("ORD-2026-8812");
    expect(codes[0]).toBe(104); // Start Code B
    expect(codes[codes.length - 1]).toBe(106); // Stop Code
    // Length = 1 (start) + 13 (chars) + 1 (checksum) + 1 (stop) = 16
    expect(codes.length).toBe(16);

    // Verify modulo-103 checksum manually
    let expectedSum = 104;
    const text = "ORD-2026-8812";
    for (let i = 0; i < text.length; i++) {
      expectedSum += (text.charCodeAt(i) - 32) * (i + 1);
    }
    expect(codes[codes.length - 2]).toBe(expectedSum % 103);
  });

  it("generates valid SVG markup and bar geometry with quiet zones", () => {
    const svg = generateCode128SvgMarkup("AMZ-405-1234567", 40);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");

    const { bars, totalModules } = getCode128Bars("OP-042");
    expect(bars.length).toBeGreaterThan(15);
    expect(bars[0].x).toBe(10); // 10-module left quiet zone
    const lastBar = bars[bars.length - 1];
    expect(totalModules).toBeGreaterThanOrEqual(lastBar.x + lastBar.width + 10);
  });
});

describe("Italian Address Parser & DHL Normalizer", () => {
  it("separates street, civico, and floor/stair additions including dot abbreviations (p., sc., int.)", () => {
    const a1 = parseItalianAddress("Via Ugo Palermo 6, 4 piano");
    expect(a1.street).toBe("Via Ugo Palermo");
    expect(a1.houseNumber).toBe("6");
    expect(a1.addressAddition).toContain("4 piano");
    expect(a1.status).toBe("valid");

    const a2 = parseItalianAddress("Corso Buenos Aires 42, sc. B int. 4");
    expect(a2.street).toBe("Corso Buenos Aires");
    expect(a2.houseNumber).toBe("42");
    expect(a2.addressAddition).toContain("sc. B int. 4");

    const a3 = parseItalianAddress("Via Giuseppe Verdi 12/A, p. 2");
    expect(a3.street).toBe("Via Giuseppe Verdi");
    expect(a3.houseNumber).toBe("12/A");
    expect(a3.addressAddition).toContain("p. 2");
  });

  it("handles SNC (Senza Numero Civico) and flags missing house numbers", () => {
    const snc = parseItalianAddress("Contrà Porti snc");
    expect(snc.houseNumber.toUpperCase()).toBe("SNC");
    expect(snc.status).toBe("valid");

    const missing = parseItalianAddress("Via Roma");
    expect(missing.houseNumber).toBe("");
    expect(missing.status).toBe("warning");
    expect(missing.validationError).toBeDefined();
  });

  it("parses multi-line Italian address blocks for any city (not just hardcoded cities)", () => {
    const block = parseFullAddressBlock(
      "Giulia Ferraro\nVia Mazzini 18, int. 3\n37121 Verona VR\nItalia",
    );
    expect(block).not.toBeNull();
    expect(block?.customerName).toBe("Giulia Ferraro");
    expect(block?.street).toBe("Via Mazzini");
    expect(block?.houseNumber).toBe("18");
    expect(block?.addressAddition).toContain("int. 3");
    expect(block?.zip).toBe("37121");
    expect(block?.city).toContain("Verona");
  });

  it("recognizes identical Italian addresses when 'Via' is omitted or comma is attached without space (Bolzano warehouse real case)", () => {
    // Exact case from warehouse screen: 'Via Fabio Filzi 35' vs 'Fabio Filzi,35'
    const a1 = parseItalianAddress("Via Fabio Filzi 35");
    expect(a1.street).toBe("Via Fabio Filzi");
    expect(a1.houseNumber).toBe("35");
    expect(a1.status).toBe("valid");

    const a2 = parseItalianAddress("Fabio Filzi,35");
    expect(a2.street).toBe("Fabio Filzi");
    expect(a2.houseNumber).toBe("35");
    expect(a2.status).toBe("valid");

    expect(
      areItalianAddressesMatching(
        "Via Fabio Filzi 35",
        "Fabio Filzi,35",
        "20063",
        "20063",
      ),
    ).toBe(true);

    // Other warehouse screen cases: S.pietro 10a, Via Dei Monti Parioli 49/a, Viale Camillo Golgi 66a
    const a3 = parseItalianAddress("S.pietro 10a");
    expect(a3.street).toBe("S.pietro");
    expect(a3.houseNumber).toBe("10a");
    expect(a3.status).toBe("valid");

    const a4 = parseItalianAddress("Via Dei Monti Parioli 49/a");
    expect(a4.houseNumber).toBe("49/a");
    expect(a4.status).toBe("valid");

    const a5 = parseItalianAddress("Viale Camillo Golgi 66a");
    expect(a5.houseNumber).toBe("66a");
    expect(a5.status).toBe("valid");
  });
});

describe("Bolzano Real Bottle Barcodes & Selly CSV Poka-Yoke Safety", () => {
  it("resolves real bottle EANs & UPC aliases from Bolzano warehouse (Vegan & Arktis)", () => {
    const vegan = matchCatalogProduct("0781490329894", "", NORSAN_PRODUCTS);
    expect(vegan).toBeDefined();
    expect(vegan?.sku).toBe("NOR-VEG-100-LEM");

    const veganShort = matchCatalogProduct("976294405", "", NORSAN_PRODUCTS);
    expect(veganShort?.sku).toBe("NOR-VEG-100-LEM");

    const arktis = matchCatalogProduct("0781490329856", "", NORSAN_PRODUCTS);
    expect(arktis).toBeDefined();
    expect(arktis?.sku).toBe("NOR-ARK-200-LEM");
  });

  it("never assigns real Omega-3 Total Limone EAN (4260368140018) to unknown imported SKUs", () => {
    const csv = `Numero;Data;Cliente;Indirizzo;Citta;CAP;Prov;Corriere;Codice Articolo;Descrizione;Quantita;Prezzo;Note
ORD-2026-999;16/10/2026;Marco Neri;Via Dante 5;Bolzano;39100;BZ;DHL;SKU-IGNOTO-777;Kit Speciale Consegna Rapida;1;49.00;`;

    const res = parseSellyOrdersCsv(csv, NORSAN_PRODUCTS);
    expect(res.orders).toHaveLength(1);
    const item = res.orders[0].items[0];
    expect(item.product.ean).not.toBe("4260368140018");
    expect(item.product.ean).toBe("SKU-IGNOTO-777");
  });

  it("exposes Selly ERP sync configuration endpoints on backend", async () => {
    const getRes = await request(app).get("/api/selly/config");
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty("syncIntervalMinutes");

    const syncRes = await request(app).post("/api/selly/sync-now").send({});
    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(false); // No API key configured in test env
  });
});

describe("FEFO Expiry & Batch/Lot Traceability Service (HACCP Reg. CE 178/2002)", () => {
  it("returns active front-carton FEFO lot and secondary carton lot for high-runner SKUs", () => {
    const totalLimone = NORSAN_PRODUCTS.find((p) => p.sku === "NOR-TOT-200-LEM")!;
    const info = getProductLotInfo(totalLimone);
    expect(info.lotNumber).toBe("L2604N");
    expect(info.expiryDate).toBe("12/2026");
    expect(info.secondaryLot?.lotNumber).toBe("L2609N");
    expect(info.fefoStatus).toBe("fefo_priority");
  });

  it("computes FEFO status accurately based on expiry month/year and secondary lot presence", () => {
    expect(computeFefoStatus("11/2026", false)).toBe("expiring_soon");
    expect(computeFefoStatus("01/2027", false)).toBe("fefo_priority");
    expect(computeFefoStatus("09/2027", true)).toBe("fefo_priority");
    expect(computeFefoStatus("09/2027", false)).toBe("optimal");
  });

  it("rotates front carton to secondary lot and updates custom lot info cleanly", () => {
    const arktis = NORSAN_PRODUCTS.find((p) => p.sku === "NOR-ARK-200-LEM")!;
    const rotated = rotateToSecondaryLot(arktis);
    expect(rotated.lotNumber).toBe("L2610A");
    expect(rotated.expiryDate).toBe("10/2027");

    const updated = updateProductLotInfo("NOR-ARK-200-LEM", "l2701a", "11/2027");
    expect(updated.lotNumber).toBe("L2701A");
    expect(updated.expiryDate).toBe("11/2027");
    expect(updated.fefoStatus).toBe("optimal");
  });
});

describe("Main Warehouse Inventory, Kanban Transfer & Shelf-Life Run-Rate Forecast", () => {
  it("calculates two-tier stock (closed cartons * unitsPerCarton + packing shelf) and detects ERP discrepancies", () => {
    const inv = getWarehouseInventory(NORSAN_PRODUCTS);
    const vegan = inv.find((i) => i.sku === "NOR-VEG-100-LEM")!;
    // 14 cartons * 12 + 10 = 178 physical vs 180 ERP => -2 discrepancy
    expect(vegan.physicalTotalUnits).toBe(178);
    expect(vegan.discrepancyUnits).toBe(-2);

    const kids = inv.find((i) => i.sku === "NOR-KID-OIL-150")!;
    // 230 units @ 55/month (~4.2 months) vs expiry 12/2026 (2 months => max sellable 110) => 120 units at risk
    expect(kids.writeOffRiskUnits).toBe(120);
    expect(kids.stockHealth).toBe("overstock_expiry_risk");
  });

  it("transfers master cartons from pallet to packing shelf (Kanban) without changing total physical stock", () => {
    const afterKanban = transferCartonsToPackingShelf(
      NORSAN_PRODUCTS,
      "NOR-TOT-200-LEM",
      2,
    );
    const total = afterKanban.find((i) => i.sku === "NOR-TOT-200-LEM")!;
    expect(total.closedCartonsOnPallet).toBe(36); // 38 - 2
    expect(total.openUnitsOnPackingShelf).toBe(64); // 24 + 40
    expect(total.physicalTotalUnits).toBe(784);
  });

  it("records rapid physical cycle counts and receives inbound pallets from Berlin", () => {
    const afterCount = recordPhysicalCount(
      NORSAN_PRODUCTS,
      "NOR-VEG-100-LEM",
      14,
      12,
      true,
    );
    const vegan = afterCount.find((i) => i.sku === "NOR-VEG-100-LEM")!;
    expect(vegan.physicalTotalUnits).toBe(180);
    expect(vegan.discrepancyUnits).toBe(0);

    const afterInbound = receiveInboundPallet(
      NORSAN_PRODUCTS,
      "NOR-TOT-200-NAT",
      10,
      "L2705T",
      "12/2027",
    );
    const nat = afterInbound.find((i) => i.sku === "NOR-TOT-200-NAT")!;
    expect(nat.closedCartonsOnPallet).toBe(26); // 16 + 10
    expect(nat.lotNumber).toBe("L2705T");
  });
});


