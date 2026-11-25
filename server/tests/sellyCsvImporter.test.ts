import { describe, it, expect } from "vitest";
import { parseSellyOrdersCsv } from "../../src/services/sellyCsvImporter";
import { NORSAN_PRODUCTS } from "../../src/data/norsanProducts";

describe("Selly ERP CSV Importer", () => {
  it("correctly parses Italian semicolon-delimited CSV with quotes and service items", () => {
    const csvContent = `Numero;Data;Cliente;Indirizzo;Citta;CAP;Prov;Corriere;Codice Articolo;Descrizione;Quantita;Prezzo;Note
ORD-2026-901;05/10/2026;Mario Rossi;Via Roma 10;Milano;20121;MI;DHL Express;NOR-TOT-200-LEM;NORSAN Omega-3 Total Limone;2;27.00;Citofono 4B
ORD-2026-901;05/10/2026;Mario Rossi;Via Roma 10;Milano;20121;MI;DHL Express;SPED-01;Spese di Spedizione Express;1;6.50;Citofono 4B
ORD-2026-902;05/10/2026;Elena Bianchi;Corso Francia 40;Torino;10138;TO;DHL Paket;0781490329856;Omega-3 Arktis Olio 200ml;1;29.00;Lasciare al portiere
`;

    const result = parseSellyOrdersCsv(csvContent, NORSAN_PRODUCTS);

    expect(result.errors).toHaveLength(0);
    expect(result.orders).toHaveLength(2);

    // Order 1 verification
    const ord1 = result.orders.find((o) => o.orderNumber === "ORD-2026-901");
    expect(ord1).toBeDefined();
    expect(ord1?.customerName).toBe("Mario Rossi");
    expect(ord1?.customerCity).toBe("Milano");
    expect(ord1?.items).toHaveLength(1); // SPED-01 filtered out!
    expect(ord1?.items[0].product.sku).toBe("NOR-TOT-200-LEM");
    expect(ord1?.items[0].quantityRequired).toBe(2);
    expect(ord1?.specialNotes).toBe("Citofono 4B");

    // Order 2 verification (matched via factory barcode alias 0781490329856)
    const ord2 = result.orders.find((o) => o.orderNumber === "ORD-2026-902");
    expect(ord2).toBeDefined();
    expect(ord2?.customerName).toBe("Elena Bianchi");
    expect(ord2?.items).toHaveLength(1);
    expect(ord2?.items[0].product.sku).toBe("NOR-ARK-200-LEM");
    expect(ord2?.items[0].quantityRequired).toBe(1);

    // Summary verification
    expect(result.summary.totalOrders).toBe(2);
    expect(result.summary.skippedServiceRows).toBe(1);
  });

  it("consolidates multi-site orders for the same customer (INT + IT + foten) into 1 unified shipment", () => {
    const csvContent = `Numero;Data;Cliente;Indirizzo;Citta;CAP;Prov;Corriere;Codice Articolo;Descrizione;Quantita;Prezzo
INT55813;24/11/2026;Ester Walker;Via Dott. Alice 15;Bolzano;39100;BZ;DHL Express;5000-097;Magnesio Glicinato ZREEN;1;23.11
INT55813;24/11/2026;Ester Walker;Via Dott. Alice 15;Bolzano;39100;BZ;DHL Express;3000-001;Spedizione;1;4.55
IT101778;24/11/2026;Ester Walker;Via Dott. Alice 15;Bolzano;39100;BZ;DHL Express;1000-002;Omega-3 Total Capsule NORSAN;1;23.11
IT101778;24/11/2026;Ester Walker;Via Dott. Alice 15;Bolzano;39100;BZ;DHL Express;FOT-900;Olio Foten Cane 100ml;1;19.90
IT101778;24/11/2026;Ester Walker;Via Dott. Alice 15;Bolzano;39100;BZ;DHL Express;3000-001;Spedizione;1;4.55
`;

    const result = parseSellyOrdersCsv(csvContent, NORSAN_PRODUCTS);

    expect(result.errors).toHaveLength(0);
    expect(result.summary.skippedServiceRows).toBe(2);
    expect(result.orders).toHaveLength(1);

    const unified = result.orders[0];
    expect(unified.linkedOrderNumbers).toEqual(["INT55813", "IT101778"]);
    expect(unified.linkedBarcodes).toEqual(["INT55813", "IT101778"]);
    expect(unified.items).toHaveLength(3);
    expect(unified.items.some((i) => i.product.brand === "ZREEN")).toBe(true);
    expect(unified.items.some((i) => i.product.brand === "FOTEN")).toBe(true);

    const flyerCodes = unified.marketingFlyers.map((f) => f.code);
    expect(flyerCodes).toContain("FLY-ZRE-NUTRA");
    expect(flyerCodes).toContain("FLY-FOTEN");
    expect(unified.boxBranding).not.toBe("zreen_logo");
  });
});
