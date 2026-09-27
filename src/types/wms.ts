export type ProductCategory = 'oil' | 'capsules' | 'kids' | 'vitamins' | 'nutraceutical' | 'collagen';
export type PackageType = 'glass_bottle' | 'plastic_bottle' | 'blister_box' | 'dropper' | 'jar_powder';
export type RackSide = 'S' | 'D'; // S = Sinistra (Left), D = Destra (Right) per standard italiano magazzino
export type BrandFamily = 'NORSAN' | 'ZREEN' | 'AMAZON_WHITE_LABEL';

export interface Product {
  id: string;
  sku: string;
  name: string;
  italianName: string;
  ean: string; // Barcode scanned by physical scanner
  category: ProductCategory;
  brand: BrandFamily; // NORSAN vs ZREEN (Azienda Docciaria Nutraceutica)
  volume: string; // e.g. "200 ml", "120 capsule", "300 g"
  packageType: PackageType;
  shelfLocation: string; // e.g. "S1-A", "S2-C", "D2-C" (S=Sinistra, D=Destra)
  rackSide: RackSide;
  tier: 1 | 2 | 3; // 1 = Basso (Terra), 2 = Medio (Golden Zone), 3 = Alto
  weightGrams: number;
  imageUrl: string;
  barcodeText: string;
  fragile: boolean; // Glass bottle packaging requires bubble wrap
  instructions?: string;
  storageZone?: StorageZone;
  shelfCoordinate?: string;
  colorCategory?: ZreenColorCategory;
}

export interface OrderItem {
  product: Product;
  quantityRequired: number;
  quantityScanned: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overpack';
}

export type OrderPriority = 'standard' | 'express' | 'urgent';
export type BoxBranding = 'norsan_logo' | 'zreen_logo' | 'neutral_unbranded';

export type BoxType =
  | 'BOX-NOR-S'
  | 'BOX-NOR-M'
  | 'BOX-NOR-L'
  | 'BOX-ZRE-S'
  | 'BOX-ZRE-M'
  | 'BOX-ZRE-L'
  | 'BOX-AMZ-S'
  | 'BOX-AMZ-M'
  | 'BOX-AMZ-L';

export type CourierService = 'DHL Express' | 'DHL Paket';
export type OrderSource = 'norsan.it Web Shop' | 'zreen.it Shop' | 'Amazon Marketplace' | 'B2B Farmacia EDI' | 'WhatsApp / Telefono';

export type StorageZone = 'norsan_side_shelf' | 'zreen_rack_shared';
export type PhysicalSide = 'left' | 'right';

export interface StationConfig {
  stationId: 'STATION_01' | 'STATION_02' | 'STATION_03';
  stationName: string;
  norsanSide: PhysicalSide; // 'left' для Столу 1, 'right' для Столу 2
  zreenSide: PhysicalSide;  // 'right' для Столу 1, 'left' для Столу 2
}

export type RetentionGiftType = 'none' | 'card_discount_15' | 'branded_spoon' | 'retest_flyer_kit';
export type ZreenColorCategory = 'sleep_calm' | 'gut_detox' | 'amino_energy';

export interface MarketingFlyer {
  id: string;
  code: string; // Barcode e.g. "FLY-NOR-ITA", "FLY-ZRE-NUTRA"
  title: string;
  italianTitle: string;
  shelfLocation: string; // e.g. "D3-C"
  brand: BrandFamily;
  isIncluded: boolean; // Checked by packer
  storageZone?: StorageZone;
  shelfCoordinate?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "ORD-2026-8812"
  barcode: string; // "ORD-2026-8812"
  source: OrderSource;
  createdAt: number;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerZip: string;
  customerProvince: string;
  customerCountry: string; // "IT", "DE", "AT", "CH"
  courier: CourierService;
  trackingNumber: string;
  priority: OrderPriority;
  boxBranding: BoxBranding; // Logo NORSAN vs Logo ZREEN vs Senza Logo Amazon
  boxRecommendation: BoxType;
  items: OrderItem[];
  marketingFlyers: MarketingFlyer[]; // Opuscoli / flyer pubblicitari obbligatori
  status: 'ready_to_pack' | 'packing' | 'packed' | 'shipped';
  specialNotes?: string;
  assignedOperatorId?: string;
  packingStartedAt?: number;
  packingCompletedAt?: number;
  // Subscription fields
  isSubscription: boolean;
  subscriptionCycle?: number; // e.g., 1, 3, 6
  subscriptionFrequency?: 'monthly' | 'bimonthly';
  // MVP fields
  customerOrderCount: number;
  retentionGift?: RetentionGiftType;
  giftConfirmed?: boolean;
  requiresPhysicalDocument?: boolean;
  physicalDocumentConfirmed?: boolean;
}

export type ScanResultType =
  | 'product_match'
  | 'flyer_match'
  | 'order_switch'
  | 'box_selected'
  | 'operator_login'
  | 'command'
  | 'wrong_product'
  | 'overpack'
  | 'unknown_code';

export interface ScanEvent {
  id: string;
  rawCode: string;
  resultType: ScanResultType;
  status: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  matchedProduct?: Product;
}

export interface Operator {
  id: string;
  operatorCode: string; // e.g. "OP-042" (Badge barcode)
  name: string;
  role: 'packer' | 'team_lead' | 'supervisor';
  stationId: string;
  shift: string; // e.g. "Mattina (06:00 - 14:00)"
  avatarUrl: string;
  packedToday: number;
  accuracy: number;
  uph: number;
  errorsPrevented: number;
}

export interface IssueTicket {
  id: string;
  orderNumber: string;
  stationId: string;
  operatorName: string;
  type: string;
  note: string;
  timestamp: number;
  status: 'pending' | 'resolved';
}

export interface WarehouseStation {
  id: string;
  name: string;
  operatorName: string;
  operatorCode: string;
  currentOrderNumber?: string;
  status: 'packing' | 'idle' | 'issue' | 'break';
  ordersPackedToday: number;
  currentSpeedUPH: number;
  accuracy: number;
}

export interface StationKPIs {
  totalPackedToday: number;
  unitsPerHour: number;
  accuracyPercentage: number;
  errorsPrevented: number;
  activeOrderTimeSeconds: number;
}
