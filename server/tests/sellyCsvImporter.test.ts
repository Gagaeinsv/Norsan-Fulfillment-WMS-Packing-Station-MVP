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
});
