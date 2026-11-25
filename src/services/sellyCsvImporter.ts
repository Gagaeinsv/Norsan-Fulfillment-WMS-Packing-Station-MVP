import { Order, OrderItem, Product, BoxType, BoxBranding, BrandFamily, MarketingFlyer } from "../types/wms";
import { MARKETING_FLYERS, isSellyErpServiceSku } from "../data/marketingFlyers";
import { NORSAN_PRODUCTS } from "../data/norsanProducts";
import { parseItalianAddress } from "./italianAddressParser";

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

  // 0. Check custom barcode bindings saved by operator
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("wms_custom_barcode_bindings");
      if (saved) {
        const bindings: Record<string, string> = JSON.parse(saved);
        const targetSku =
          bindings[cleanCode] ||
          bindings[digitsOnly] ||
          (noZero ? bindings[noZero] : undefined);
        if (targetSku) {
          const boundProd = catalog.find(
            (p) => p.sku.toUpperCase() === targetSku.toUpperCase()
          );
          if (boundProd) return boundProd;
        }
      }
    } catch {
      // ignore localStorage read errors
    }
  }

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
    "spese di spedizione",
    "contributo spedizione",
    "costo spedizione",
    "spese trasporto",
    "porto franco",
    "porto assegnato",
    "diritto contrassegno",
    "spese contrassegno",
    "spese incasso",
    "commissione",
    "bollo virtuale",
  ];

  return serviceKeywords.some((kw) => text.includes(kw));
}

function detectFallbackBrand(sku: string, description: string): BrandFamily {
  const upperSku = (sku || "").toUpperCase();
  const lowerDesc = (description || "").toLowerCase();

  if (
    upperSku.startsWith("5000-") ||
    upperSku.includes("ZRE") ||
    lowerDesc.includes("zreen")
  ) {
    return "ZREEN";
  }

  if (upperSku.includes("FOT") || lowerDesc.includes("foten")) {
    return "FOTEN";
  }

  return "NORSAN";
}

function getFlyerByCode(code: string): MarketingFlyer | undefined {
  const found = MARKETING_FLYERS.find((f) => f.code === code);
  return found ? { ...found, isIncluded: false } : undefined;
}

function resolveShipmentPackagingAndFlyers(
  items: OrderItem[],
  existingFlyers: MarketingFlyer[] = [],
  preserveAmazonNeutral: boolean = false,
): {
  boxRecommendation: BoxType;
  boxBranding: BoxBranding;
  marketingFlyers: MarketingFlyer[];
} {
  const totalUnits = items.reduce((s, it) => s + it.quantityRequired, 0);
  const brands = new Set<BrandFamily>(items.map((it) => it.product.brand));
  const sizeSuffix: "S" | "M" | "L" =
    totalUnits > 5 ? "L" : totalUnits > 2 ? "M" : "S";

  let boxRecommendation: BoxType = `BOX-NOR-${sizeSuffix}`;
  let boxBranding: BoxBranding = "norsan_logo";

  if (preserveAmazonNeutral) {
    boxRecommendation = `BOX-AMZ-${sizeSuffix}`;
    boxBranding = "neutral_unbranded";
  } else if (brands.size === 1 && brands.has("ZREEN")) {
    boxRecommendation = totalUnits > 5 ? "BOX-ZRE-L" : "BOX-ZRE-M";
    boxBranding = "zreen_logo";
  } else if (brands.size === 1 && brands.has("FOTEN")) {
    // foten has no dedicated branded box
    boxRecommendation = `BOX-AMZ-${sizeSuffix}`;
    boxBranding = "neutral_unbranded";
  } else if (brands.has("NORSAN")) {
    boxRecommendation = `BOX-NOR-${sizeSuffix}`;
    boxBranding = "norsan_logo";
  } else if (brands.has("ZREEN")) {
    boxRecommendation = `BOX-ZRE-${sizeSuffix}`;
    boxBranding = "zreen_logo";
  }

  if (preserveAmazonNeutral) {
    return {
      boxRecommendation,
      boxBranding,
      marketingFlyers: existingFlyers,
    };
  }

  const flyersMap = new Map<string, MarketingFlyer>();
  const addByCode = (code: string) => {
    if (flyersMap.has(code)) return;
    const preset = getFlyerByCode(code);
    if (preset) flyersMap.set(code, preset);
  };

  if (brands.has("NORSAN")) addByCode("FLY-NOR-ITA");
  if (brands.has("ZREEN")) addByCode("FLY-ZRE-NUTRA");
  if (brands.has("FOTEN")) addByCode("FLY-FOTEN");

  for (const f of existingFlyers) {
    if (!flyersMap.has(f.code)) {
      flyersMap.set(f.code, { ...f });
    } else if (f.isIncluded) {
      flyersMap.set(f.code, { ...flyersMap.get(f.code)!, isIncluded: true });
    }
  }

  if (flyersMap.size === 0) {
    addByCode("FLY-NOR-ITA");
  }

  return {
    boxRecommendation,
    boxBranding,
    marketingFlyers: Array.from(flyersMap.values()),
  };
}

function normalizeConsolidationPart(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isAmazonChannelOrder(order: Order): boolean {
  return (
    order.source === "Amazon Marketplace" ||
    order.boxBranding === "neutral_unbranded" ||
    Boolean(order.boxRecommendation?.startsWith("BOX-AMZ"))
  );
}

/**
 * Merges orders from different channels/sites (e.g. INT... + IT...) belonging to the
 * same customer and shipping destination into one unified shipment (1 box / 1 DHL label).
 */
export function consolidateMultiOrderShipments(orders: Order[]): Order[] {
  const result: Order[] = [];
  const groups = new Map<string, number>();

  for (const ord of orders) {
    const baseLinkedNums = Array.from(
      new Set(
        (ord.linkedOrderNumbers && ord.linkedOrderNumbers.length > 0
          ? ord.linkedOrderNumbers
          : [ord.orderNumber]
        ).filter(Boolean),
      ),
    );
    const baseLinkedBarcodes = Array.from(
      new Set(
        (ord.linkedBarcodes && ord.linkedBarcodes.length > 0
          ? ord.linkedBarcodes
          : [ord.barcode || ord.orderNumber, ...baseLinkedNums]
        )
          .filter(Boolean)
          .map((c) => c.trim().toUpperCase()),
      ),
    );

    const normalizedOrd: Order = {
      ...ord,
      linkedOrderNumbers: baseLinkedNums,
      linkedBarcodes: baseLinkedBarcodes,
    };

    const normName = normalizeConsolidationPart(normalizedOrd.customerName);
    const normAddr = normalizeConsolidationPart(normalizedOrd.customerAddress);
    const normZip = normalizeConsolidationPart(normalizedOrd.customerZip);
    const normCity = normalizeConsolidationPart(normalizedOrd.customerCity);

    const isEligible =
      normalizedOrd.status !== "packed" &&
      normalizedOrd.status !== "shipped" &&
      Boolean(normName) &&
      normName !== "cliente selly erp" &&
      Boolean(normAddr) &&
      normAddr !== "indirizzo non specificato";

    if (!isEligible) {
      result.push(normalizedOrd);
      continue;
    }

    const isAmz = isAmazonChannelOrder(normalizedOrd);
    const key = `${isAmz ? "AMZ" : "STD"}|${normName}|${normZip}|${normCity}|${normAddr}`;
    const existingIdx = groups.get(key);

    if (existingIdx === undefined) {
      groups.set(key, result.length);
      result.push(normalizedOrd);
      continue;
    }

    const primary = result[existingIdx];

    // Merge items cleanly by product ID or SKU
    const mergedItemsMap = new Map<string, OrderItem>();
    for (const it of [...primary.items, ...normalizedOrd.items]) {
      const itemKey = it.product.id || it.product.sku;
      const existingItem = mergedItemsMap.get(itemKey);
      if (existingItem) {
        const req = existingItem.quantityRequired + it.quantityRequired;
        const sc = existingItem.quantityScanned + it.quantityScanned;
        mergedItemsMap.set(itemKey, {
          ...existingItem,
          quantityRequired: req,
          quantityScanned: sc,
          status: sc >= req ? "completed" : sc > 0 ? "in_progress" : "pending",
        });
      } else {
        mergedItemsMap.set(itemKey, { ...it });
      }
    }
    const mergedItems = Array.from(mergedItemsMap.values());

    const mergedOrderNums = Array.from(
      new Set([
        ...(primary.linkedOrderNumbers || [primary.orderNumber]),
        ...(normalizedOrd.linkedOrderNumbers || [normalizedOrd.orderNumber]),
      ]),
    );
    const mergedBarcodes = Array.from(
      new Set([
        ...(primary.linkedBarcodes || []),
        ...(normalizedOrd.linkedBarcodes || []),
      ]),
    );

    const { boxRecommendation, boxBranding, marketingFlyers } =
      resolveShipmentPackagingAndFlyers(
        mergedItems,
        [...(primary.marketingFlyers || []), ...(normalizedOrd.marketingFlyers || [])],
        isAmz,
      );

    const unifiedTag = `ORDINE UNIFICATO (${mergedOrderNums.join(" + ")}) · 1 scatola / 1 etichetta DHL`;
    const noteParts = Array.from(
      new Set(
        [primary.specialNotes, normalizedOrd.specialNotes, unifiedTag]
          .filter((n): n is string => Boolean(n && n.trim()))
          .map((n) => n.trim()),
      ),
    );

    result[existingIdx] = {
      ...primary,
      items: mergedItems,
      linkedOrderNumbers: mergedOrderNums,
      linkedBarcodes: mergedBarcodes,
      boxRecommendation,
      boxBranding,
      marketingFlyers,
      isSubscription: primary.isSubscription || normalizedOrd.isSubscription,
      requiresPhysicalDocument:
        Boolean(primary.requiresPhysicalDocument) ||
        Boolean(normalizedOrd.requiresPhysicalDocument),
      specialNotes: noteParts.join(" · "),
    };
  }

  return result;
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
        const safeFallbackCode =
          rawItem.sku || `UNBOUND-${orderNum}-${orderItems.length + 1}`;
        const inferredBrand = detectFallbackBrand(rawItem.sku, rawItem.description);
        // Create resilient fallback product without colliding with any real product EAN
        matchedProd = {
          id: `selly-${rawItem.sku || Math.random().toString(36).substring(7)}`,
          sku: safeFallbackCode,
          name: rawItem.description || rawItem.sku || "Articolo Selly ERP",
          italianName: rawItem.description || rawItem.sku || "Articolo Selly ERP",
          ean: safeFallbackCode,
          category: "oil",
          brand: inferredBrand,
          volume: "200 ml",
          packageType: "glass_bottle",
          shelfLocation: "N-TEMP",
          shelfCoordinate: "N-TEMP",
          rackSide: "S",
          tier: 2,
          weightGrams: 420,
          imageUrl:
            "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&80",
          barcodeText: safeFallbackCode,
          fragile: true,
          instructions: "Articolo non associato a EAN standard. Associare codice o confermare da bolla.",
          aliases: rawItem.sku ? [rawItem.sku] : [],
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

    const { boxRecommendation, boxBranding, marketingFlyers } =
      resolveShipmentPackagingAndFlyers(orderItems);

    const parsedAddr = parseItalianAddress(group.customerAddress);

    const newOrder: Order = {
      id: `ord-selly-${orderNum}`,
      orderNumber: orderNum,
      barcode: orderNum,
      linkedOrderNumbers: [orderNum],
      linkedBarcodes: [orderNum.toUpperCase()],
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
      boxBranding,
      boxRecommendation,
      addressDetails: parsedAddr,
      addressStatus: parsedAddr.status,
      items: orderItems,
      marketingFlyers,
      status: "ready_to_pack",
      isSubscription: group.specialNotes.toLowerCase().includes("abbonament"),
      customerOrderCount: 1,
      retentionGift: "card_discount_15",
      specialNotes: group.specialNotes || undefined,
      sellyErpOrderId: orderNum,
    };

    finalOrders.push(newOrder);
  });

  const consolidatedOrders = consolidateMultiOrderShipments(finalOrders);

  return {
    orders: consolidatedOrders,
    errors,
    summary: {
      totalRows: rows.length,
      totalOrders: consolidatedOrders.length,
      totalItems: totalItemsCount,
      skippedServiceRows,
      unrecognizedSkus: Array.from(unrecognizedSkusSet),
    },
  };
}
