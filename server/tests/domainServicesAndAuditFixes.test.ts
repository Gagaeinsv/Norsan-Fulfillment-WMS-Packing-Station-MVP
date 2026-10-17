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

