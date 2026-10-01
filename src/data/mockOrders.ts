import { Order } from '../types/wms';
import { NORSAN_PRODUCTS } from './norsanProducts';

// Helper: find product by SKU with safety check
const p = (sku: string) => {
  const found = NORSAN_PRODUCTS.find(prod => prod.sku === sku);
  if (!found) throw new Error(`[mockOrders] SKU not found: "${sku}"`);
  return found;
};

const RAW_ORDERS: Order[] = [
  // ─────────────────────────────────────────────────────────────────────
  // ORDINE 1: 1° ordine → Retention Gift 15% card
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'ord-mvp-1',
    orderNumber: 'ORDVE2026121172',
    barcode: 'ORDVE2026121172',
    source: 'norsan.it Web Shop',
    createdAt: Date.now() - 1000 * 60 * 15,
    customerName: 'Ana Martin',
    customerAddress: "Via dell'Indipendenza, 12",
    customerCity: 'Bologna',
    customerZip: '40121',
    customerProvince: 'BO',
    customerCountry: 'IT',
    courier: 'DHL Paket',
    trackingNumber: 'DHL-8812-7473',
    priority: 'standard',
    boxBranding: 'norsan_logo',
    boxRecommendation: 'BOX-NOR-S',
    items: [
      { product: p('NOR-TOT-200-LEM'), quantityRequired: 1, quantityScanned: 0, status: 'pending' }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 1,
    retentionGift: 'card_discount_15',
  },
  // ─────────────────────────────────────────────────────────────────────
  // ORDINE 2: 2° ordine → Retention Gift branded spoon
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'ord-mvp-2',
    orderNumber: 'ORDVE2026121185',
    barcode: 'ORDVE2026121185',
    source: 'norsan.it Web Shop',
    createdAt: Date.now() - 1000 * 60 * 30,
    customerName: 'Marco Bianchi',
    customerAddress: 'Corso Buenos Aires, 42',
    customerCity: 'Milano',
    customerZip: '20124',
    customerProvince: 'MI',
    customerCountry: 'IT',
    courier: 'DHL Express',
    trackingNumber: 'DHL-EX-5544-112',
    priority: 'standard',
    boxBranding: 'norsan_logo',
    boxRecommendation: 'BOX-NOR-S',
    items: [
      { product: p('NOR-VEG-100-LEM'), quantityRequired: 1, quantityScanned: 0, status: 'pending' }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 2,
    retentionGift: 'branded_spoon',
  },
  // ─────────────────────────────────────────────────────────────────────
  // ORDINE 3: WhatsApp / Telefono — urgente con note mediche
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'ord-mvp-3',
    orderNumber: 'ORDVE2026121190',
    barcode: 'ORDVE2026121190',
    source: 'WhatsApp / Telefono',
    createdAt: Date.now() - 1000 * 60 * 5,
    customerName: 'Dott. Roberto Rossi',
    customerAddress: 'Via Aurelia, 145',
    customerCity: 'Roma',
    customerZip: '00165',
    customerProvince: 'RM',
    customerCountry: 'IT',
    courier: 'DHL Express',
    trackingNumber: 'DHL-EX-9988-223',
    priority: 'urgent',
    boxBranding: 'zreen_logo',
    boxRecommendation: 'BOX-ZRE-S',
    items: [
      { product: p('ZRE-BAC-60-CAP'), quantityRequired: 1, quantityScanned: 0, status: 'pending' },
      { product: p('ZRE-GAB-2000-CAP'), quantityRequired: 1, quantityScanned: 0, status: 'pending' },
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    specialNotes: 'Urgente: Consegna presso Studio Medico entro le 13:00. Non inserire fattura',
    isSubscription: false,
    customerOrderCount: 5,
    retentionGift: 'none',
  },
  // ─────────────────────────────────────────────────────────────────────
  // ORDINE 4: Amazon FBM — scatola neutra
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'ord-mvp-4',
    orderNumber: '403-3329096-6591533',
    barcode: '403-3329096-6591533',
    source: 'Amazon Marketplace',
    createdAt: Date.now() - 1000 * 60 * 45,
    customerName: 'Sara Morici',
    customerAddress: 'Via Zamboni, 33',
    customerCity: 'Bologna',
    customerZip: '40126',
    customerProvince: 'BO',
    customerCountry: 'IT',
    courier: 'DHL Express',
    trackingNumber: 'DHL-EX-AMZ-777',
    priority: 'express',
    boxBranding: 'neutral_unbranded',
    boxRecommendation: 'BOX-AMZ-S',
    items: [
      { product: p('NOR-KID-JEL-45'), quantityRequired: 1, quantityScanned: 0, status: 'pending' }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 1,
    retentionGift: 'none',
    requiresPhysicalDocument: false,
  },
  // ─────────────────────────────────────────────────────────────────────
  // ORDINE 5: B2B Farmacia — fattura fisica obbligatoria
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'ord-mvp-5',
    orderNumber: 'B2B-FARM-202612',
    barcode: 'B2B-FARM-202612',
    source: 'B2B Farmacia EDI',
    createdAt: Date.now() - 1000 * 60 * 60,
    customerName: 'Farmacia San Raffaele',
    customerAddress: 'Via Olgettina, 60',
    customerCity: 'Milano',
    customerZip: '20132',
    customerProvince: 'MI',
    customerCountry: 'IT',
    courier: 'DHL Paket',
    trackingNumber: 'DHL-B2B-9988-777',
    priority: 'standard',
    boxBranding: 'norsan_logo',
    boxRecommendation: 'BOX-NOR-M',
    items: [
      { product: p('NOR-TOT-200-LEM'), quantityRequired: 6, quantityScanned: 0, status: 'pending' }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    specialNotes: 'B2B Pharmacy. Stampare Documento di Trasporto (DDT) / Fattura',
    isSubscription: false,
    customerOrderCount: 10,
    retentionGift: 'none',
    requiresPhysicalDocument: true,
  },
  // ─────────────────────────────────────────────────────────────────────
  // ORDINE 6: SellyErp INT50953 — clienti fedele (4° ordine)
  // Dimostra: filtro SKU servizio 3000-001 (spedizione €0), badge fidelità
  // Prodotto reale: 5000-019 → 5-HTP 150 su scaffale D-38
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 'ord-mvp-6',
    orderNumber: 'INT50953',
    barcode: 'INT50953',
    source: 'SellyErp INT',
    createdAt: Date.now() - 1000 * 60 * 8,
    customerName: 'Giulia Ferrari',
    customerAddress: 'Via Montenapoleone, 8',
    customerCity: 'Milano',
    customerZip: '20121',
    customerProvince: 'MI',
    customerCountry: 'IT',
    courier: 'DHL Paket',
    trackingNumber: 'DHL-INT-50953-901',
    priority: 'standard',
    boxBranding: 'zreen_logo',
    boxRecommendation: 'BOX-ZRE-S',
    // Only physical items visible to packer (service SKU 3000-001 filtered out)
    items: [
      { product: p('5000-019'), quantityRequired: 2, quantityScanned: 0, status: 'pending' }
    ],
    // Raw SellyErp lines (before filter) — used for TS demo only
    sellyErpOrderId: 'INT50953',
    sellyErpRawItems: [
      { sku: '3000-001', description: 'Spedizione Standard DHL', quantity: 1, unitPrice: 0, isService: true },
      { sku: '5000-019', description: '5-HTP 150 (ZREEN) — Scaffale D-38', quantity: 2, unitPrice: 24.90, isService: false },
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 4, // ⭐ 4th order → "Progressivo ordine cliente" badge
    retentionGift: 'retest_flyer_kit',
    requiresPhysicalDocument: false,
  },
];

export const INITIAL_ORDERS = RAW_ORDERS;
