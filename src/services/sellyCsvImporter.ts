import { Order, OrderItem, Product, BoxType, BoxBranding } from "../types/wms";
import { isSellyErpServiceSku } from "../data/marketingFlyers";
import { NORSAN_PRODUCTS } from "../data/norsanProducts";

export interface SellyImportSummary {
  totalRows: number;
  totalOrders: number;
  totalItems: number;
  skippedServiceRows: number;
  unrecognizedSkus: string[];
}

export interface SellyImportResult {
  orders: Order[];
  errors: string[];
  summary: SellyImportSummary;
}

/**
 * Robust CSV parser that handles:
 * - Italian semicolons (;) or commas (,) or tabs (\t)
 * - Quoted fields containing delimiters and newlines
 * - BOM markers (\uFEFF)
 */
function parseCsvRows(csvText: string): { rows: string[][]; delimiter: string } {
  // Strip BOM
  let text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return { rows: [], delimiter: ";" };

  // Detect delimiter from first non-empty line
  const firstLine = text.split(/\r\n|\n|\r/)[0];
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;

  let delimiter = ";";
  if (countTab > countSemi && countTab > countComma) delimiter = "\t";
  else if (countComma > countSemi) delimiter = ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: ""
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return { rows: rows.filter((r) => r.some((c) => c.length > 0)), delimiter };
}

/**
 * Matches a scanned or imported code/sku/description against catalog products
 */
export function matchCatalogProduct(
  skuOrCode: string,
  description: string,
  catalog: Product[]
): Product | undefined {
  const cleanCode = (skuOrCode || "").trim().toUpperCase();
  const digitsOnly = cleanCode.replace(/[^0-9A-Z]/g, "");
  const noZero = digitsOnly.replace(/^0+/, "");
  const descLower = (description || "").toLowerCase();

  // 1. Direct SKU or EAN match
  let found = catalog.find((p) => {
    const pSku = p.sku.toUpperCase();
    const pEan = p.ean.toUpperCase();
    const pEanNoZero = pEan.replace(/^0+/, "");

    if (pSku === cleanCode || pEan === cleanCode) return true;
    if (digitsOnly && (pEan === digitsOnly || pSku === digitsOnly)) return true;
    if (noZero && pEanNoZero && noZero === pEanNoZero) return true;

    // Check aliases
    if (p.aliases && p.aliases.length > 0) {
      return p.aliases.some((a) => {
        const aClean = a.trim().toUpperCase();
        const aNoZero = aClean.replace(/^0+/, "");
        return (
          aClean === cleanCode ||
          aClean === digitsOnly ||
          (noZero && aNoZero && noZero === aNoZero)
        );
      });
    }

    return false;
  });

  if (found) return found;

  // 2. Fallback: match by description keywords
  if (descLower) {
    if (descLower.includes("limone") && descLower.includes("total")) {
      return catalog.find((p) => p.sku === "NOR-TOT-200-LEM");
    }
    if (descLower.includes("naturale") && descLower.includes("total")) {
      return catalog.find((p) => p.sku === "NOR-TOT-200-NAT");
    }
    if (descLower.includes("arktis") && descLower.includes("limone")) {
      return catalog.find((p) => p.sku === "NOR-ARK-200-LEM");
    }
    if (descLower.includes("arktis") && descLower.includes("naturale")) {
      return catalog.find((p) => p.sku === "NOR-ARK-200-NAT");
    }
    if (descLower.includes("vegan") || descLower.includes("vegano")) {
      return catalog.find((p) => p.sku === "NOR-VEG-100-LEM");
    }
    if (descLower.includes("capsul") && descLower.includes("total")) {
      return catalog.find((p) => p.sku === "NOR-TOT-CAP-120");
    }
    if (descLower.includes("d3") || descLower.includes("k2")) {
      return catalog.find((p) => p.sku === "NOR-VIT-D3K2-20");
    }
    if (descLower.includes("kids") && descLower.includes("olio")) {
      return catalog.find((p) => p.sku === "NOR-KID-OIL-150");
    }
    if (descLower.includes("kids") && (descLower.includes("jelly") || descLower.includes("gommose"))) {
      return catalog.find((p) => p.sku === "NOR-KID-JEL-45");
    }
  }

  return undefined;
}

/**
 * Checks if a row is a non-physical service item (shipping, payment fee, etc.)
 */
function isServiceLine(sku: string, description: string): boolean {
  if (isSellyErpServiceSku(sku)) return true;

  const text = `${sku} ${description}`.toLowerCase();
  const serviceKeywords = [
    "spediz",
    "trasport",
    "porto",
    "contrassegn",
    "spese incasso",
    "spese di spedizione",
    "handling",
    "imballo",
    "consegna",
  ];

  return serviceKeywords.some((kw) => text.includes(kw));
}

/**
 * Main Selly ERP CSV Parser
 */
export function parseSellyOrdersCsv(
  csvContent: string,
  customCatalog: Product[] = NORSAN_PRODUCTS
): SellyImportResult {
  const { rows } = parseCsvRows(csvContent);
  const errors: string[] = [];
  const unrecognizedSkusSet = new Set<string>();

  if (rows.length < 2) {
    return {
      orders: [],
      errors: ["Il file CSV è vuoto o non contiene intestazioni valide."],
      summary: {
        totalRows: 0,
        totalOrders: 0,
        totalItems: 0,
        skippedServiceRows: 0,
        unrecognizedSkus: [],
      },
    };
  }

  // Header indexing
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const findCol = (keywords: string[]): number => {
    return headers.findIndex((h) => keywords.some((kw) => h === kw || h.includes(kw)));
  };

  const colOrder = findCol([
    "numero",
    "numero ordine",
    "ordine",
    "n. ordine",
    "doc",
    "documento",
    "riferimento",
    "id ordine",
    "order number",
    "order id",
  ]);
  const colCustomer = findCol([
    "cliente",
    "ragione sociale",
    "destinatario",
    "intestatario",
    "nome",
    "customer",
  ]);
  const colAddress = findCol([
    "indirizzo",
    "destinazione",
    "indirizzo spedizione",
    "via",
    "address",
  ]);
  const colCity = findCol(["città", "citta", "comune", "località", "city"]);
  const colZip = findCol(["cap", "c.a.p.", "codice postale", "zip"]);
  const colProv = findCol(["provincia", "prov", "pr"]);
  const colCountry = findCol(["nazione", "stato", "paese", "country"]);
  const colCourier = findCol([
    "corriere",
    "vettore",
    "spedizioniere",
    "spedizione",
    "courier",
  ]);
  const colTracking = findCol(["tracking", "lettera di vettura", "ldv", "segnacollo"]);
  const colSku = findCol(["codice articolo", "codice", "sku", "articolo", "art."]);
  const colDesc = findCol([
    "descrizione",
    "descrizione articolo",
    "prodotto",
    "nome articolo",
    "description",
  ]);
  const colQty = findCol(["quantità", "quantita", "qta", "q.tà", "qtà", "pezzi", "quantity", "qty"]);
  const colPrice = findCol(["prezzo", "prezzo unitario", "importo", "totale", "price"]);
  const colNotes = findCol([
    "note",
    "note ordine",
    "note spedizione",
    "riferimenti",
    "annotazioni",
    "notes",
  ]);

  if (colOrder === -1 && colSku === -1) {
    errors.push(
      "Intestazioni non riconosciute. Il file deve contenere almeno una colonna per il Numero d'ordine o il Codice Articolo."
    );
    return {
      orders: [],
      errors,
      summary: {
        totalRows: rows.length,
        totalOrders: 0,
        totalItems: 0,
        skippedServiceRows: 0,
        unrecognizedSkus: [],
      },
    };
  }

  let skippedServiceRows = 0;
  let totalItemsCount = 0;

  // Group rows by order number
  interface RawOrderGroup {
    orderNumber: string;
    customerName: string;
    customerAddress: string;
    customerCity: string;
    customerZip: string;
    customerProvince: string;
    customerCountry: string;
    courier: string;
    trackingNumber: string;
    specialNotes: string;
    items: {
      sku: string;
      description: string;
      quantity: number;
      price: number;
    }[];
  }

  const orderMap = new Map<string, RawOrderGroup>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => !c)) continue;

    const rawOrderNum = colOrder !== -1 ? row[colOrder]?.trim() : `ORD-${i}`;
    if (!rawOrderNum) continue;

    const sku = colSku !== -1 ? row[colSku]?.trim() || "" : "";
    const description = colDesc !== -1 ? row[colDesc]?.trim() || "" : "";
    const qtyStr = colQty !== -1 ? row[colQty]?.replace(/,/g, ".").trim() || "1" : "1";
    const quantity = Math.max(1, parseInt(qtyStr, 10) || 1);
    const priceStr = colPrice !== -1 ? row[colPrice]?.replace(/,/g, ".").trim() || "0" : "0";
    const price = parseFloat(priceStr) || 0;

    // Check service rows
    if (isServiceLine(sku, description)) {
      skippedServiceRows++;
      continue;
    }

    if (!orderMap.has(rawOrderNum)) {
      const customer = colCustomer !== -1 ? row[colCustomer]?.trim() || "Cliente Selly ERP" : "Cliente Selly ERP";
      const address = colAddress !== -1 ? row[colAddress]?.trim() || "Indirizzo non specificato" : "Indirizzo non specificato";
      const city = colCity !== -1 ? row[colCity]?.trim() || "Bolzano" : "Bolzano";
      const zip = colZip !== -1 ? row[colZip]?.trim() || "39100" : "39100";
      const prov = colProv !== -1 ? row[colProv]?.trim() || "BZ" : "BZ";
      const country = colCountry !== -1 ? row[colCountry]?.trim() || "IT" : "IT";
      const courier = colCourier !== -1 ? row[colCourier]?.trim() || "DHL Paket" : "DHL Paket";
      const tracking = colTracking !== -1 ? row[colTracking]?.trim() || "" : "";
      const notes = colNotes !== -1 ? row[colNotes]?.trim() || "" : "";

      orderMap.set(rawOrderNum, {
        orderNumber: rawOrderNum,
        customerName: customer,
        customerAddress: address,
        customerCity: city,
        customerZip: zip,
        customerProvince: prov,
        customerCountry: country,
        courier: courier.toUpperCase().includes("EXPRESS") ? "DHL Express" : "DHL Paket",
        trackingNumber: tracking || `DHL-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        specialNotes: notes,
        items: [],
      });
    }

    orderMap.get(rawOrderNum)!.items.push({
      sku,
      description,
      quantity,
      price,
    });
    totalItemsCount += quantity;
  }

  // Convert groups into WMS Order objects
  const finalOrders: Order[] = [];

  orderMap.forEach((group, orderNum) => {
    const orderItems: OrderItem[] = [];

    for (const rawItem of group.items) {
      let matchedProd = matchCatalogProduct(rawItem.sku, rawItem.description, customCatalog);

      if (!matchedProd) {
        unrecognizedSkusSet.add(rawItem.sku || rawItem.description);
        // Create resilient fallback product so operator can pack it
        matchedProd = {
          id: `selly-${rawItem.sku || Math.random().toString(36).substring(7)}`,
          sku: rawItem.sku || "NOR-CUSTOM",
          name: rawItem.description || rawItem.sku || "Articolo Selly ERP",
          italianName: rawItem.description || rawItem.sku || "Articolo Selly ERP",
          ean: rawItem.sku || "4260368140018",
          category: "oil",
          brand: rawItem.sku.toUpperCase().includes("ZRE") ? "ZREEN" : "NORSAN",
          volume: "200 ml",
          packageType: "glass_bottle",
          shelfLocation: "N-TEMP",
          shelfCoordinate: "N-TEMP",
          rackSide: "S",
          tier: 2,
          weightGrams: 420,
          imageUrl:
            "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80",
          barcodeText: rawItem.sku || "4260368140018",
          fragile: true,
          instructions: "Articolo importato da Selly ERP.",
          aliases: [rawItem.sku],
        };
      }

      orderItems.push({
        product: matchedProd,
        quantityRequired: rawItem.quantity,
        quantityScanned: 0,
        status: "pending",
      });
    }

    if (orderItems.length === 0) return;

    const totalUnits = orderItems.reduce((s, it) => s + it.quantityRequired, 0);
    const hasZreenOnly = orderItems.every((it) => it.product.brand === "ZREEN");

    let boxRec: BoxType = "BOX-NOR-S";
    let boxBrand: BoxBranding = "norsan_logo";

    if (hasZreenOnly) {
      boxRec = "BOX-ZRE-M";
      boxBrand = "zreen_logo";
    } else if (totalUnits > 5) {
      boxRec = "BOX-NOR-L";
    } else if (totalUnits > 2) {
      boxRec = "BOX-NOR-M";
    }

    const newOrder: Order = {
      id: `ord-selly-${orderNum}`,
      orderNumber: orderNum,
      barcode: orderNum,
      source: "Selly ERP Import",
      createdAt: Date.now(),
      customerName: group.customerName,
      customerAddress: group.customerAddress,
      customerCity: group.customerCity,
      customerZip: group.customerZip,
      customerProvince: group.customerProvince,
      customerCountry: group.customerCountry,
      courier: group.courier as any,
      trackingNumber: group.trackingNumber,
      priority: group.courier.includes("Express") ? "express" : "standard",
      boxBranding: boxBrand,
      boxRecommendation: boxRec,
      items: orderItems,
      marketingFlyers: [
        {
          id: "fly-selly-01",
          code: "FLY-NOR-ITA",
          title: "Opuscolo NORSAN Italia Guida Omega-3",
          italianTitle: "Guida Introduttiva Omega-3 per il Consumatore",
          shelfLocation: "D3-C",
          brand: "NORSAN",
          isIncluded: false,
        },
      ],
      status: "ready_to_pack",
      isSubscription: group.specialNotes.toLowerCase().includes("abbonament"),
      customerOrderCount: 1,
      retentionGift: "card_discount_15",
      specialNotes: group.specialNotes || undefined,
      sellyErpOrderId: orderNum,
    };

    finalOrders.push(newOrder);
  });

  return {
    orders: finalOrders,
    errors,
    summary: {
      totalRows: rows.length,
      totalOrders: finalOrders.length,
      totalItems: totalItemsCount,
      skippedServiceRows,
      unrecognizedSkus: Array.from(unrecognizedSkusSet),
    },
  };
}
