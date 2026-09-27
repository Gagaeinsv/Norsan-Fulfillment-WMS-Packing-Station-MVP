import { Order } from '../types/wms';
import { NORSAN_PRODUCTS } from './norsanProducts';

const RAW_ORDERS: Order[] = [
  {
    id: 'ord-mvp-1',
    orderNumber: 'ORDVE2026121172',
    barcode: 'ORDVE2026121172',
    source: 'norsan.it Web Shop',
    createdAt: Date.now() - 1000 * 60 * 15,
    customerName: 'Ana Martin',
    customerAddress: 'Via dell\'Indipendenza, 12',
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
      {
        product: NORSAN_PRODUCTS.find(p => p.sku === 'NOR-TOT-200-LEM')!,
        quantityRequired: 1,
        quantityScanned: 0,
        status: 'pending'
      }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 1,
    retentionGift: 'card_discount_15'
  },
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
      {
        product: NORSAN_PRODUCTS.find(p => p.sku === 'NOR-VEG-100-LEM')!,
        quantityRequired: 1,
        quantityScanned: 0,
        status: 'pending'
      }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 2,
    retentionGift: 'branded_spoon'
  },
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
      {
        product: NORSAN_PRODUCTS.find(p => p.sku === 'ZRE-BAC-60-CAP')!,
        quantityRequired: 1,
        quantityScanned: 0,
        status: 'pending'
      },
      {
        product: NORSAN_PRODUCTS.find(p => p.sku === 'ZRE-HTP-60-CAP')!,
        quantityRequired: 1,
        quantityScanned: 0,
        status: 'pending'
      }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    specialNotes: 'Urgente: Consegna presso Studio Medico entro le 13:00. Non inserire fattura',
    isSubscription: false,
    customerOrderCount: 5,
    retentionGift: 'none'
  },
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
      {
        product: NORSAN_PRODUCTS.find(p => p.sku === 'NOR-KID-JEL-45')!,
        quantityRequired: 1,
        quantityScanned: 0,
        status: 'pending'
      }
    ],
    marketingFlyers: [],
    status: 'ready_to_pack',
    isSubscription: false,
    customerOrderCount: 1,
    retentionGift: 'none'
  }
];

export const INITIAL_ORDERS = RAW_ORDERS;
