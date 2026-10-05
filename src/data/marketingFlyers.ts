import { MarketingFlyer, BoxType } from "../types/wms";

// ─── Marketing Flyers ─────────────────────────────────────────────────────
// Volantini obbligatori/opzionali inseriti in ogni pacco.
export const MARKETING_FLYERS: MarketingFlyer[] = [
  {
    id: "fly-01",
    code: "FLY-NOR-ITA",
    title: "Guida Completa Omega-3 NORSAN (Italiano)",
    italianTitle: "Opuscolo NORSAN 2026: Benefici, Dosaggio e Ricette",
    shelfLocation: "N-A8",
    brand: "NORSAN",
    shelfCoordinate: "N-A8",
    isIncluded: false,
  },
  {
    id: "fly-02",
    code: "FLY-KIDS",
    title: "Opuscolo NORSAN Kids + Foglio Adesivi",
    italianTitle: "Guida Nutrizione Bambini + Scheda Giochi",
    shelfLocation: "N-A8",
    brand: "NORSAN",
    shelfCoordinate: "N-A8",
    isIncluded: false,
  },
  {
    id: "fly-03",
    code: "FLY-ZRE-NUTRA",
    title: "Brochure ZREEN Nutraceutica & Longevità",
    italianTitle: "Opuscolo ZREEN: Ashwagandha, Collagene & Inositolo",
    shelfLocation: "D-38",
    brand: "ZREEN",
    storageZone: "zreen_rack_shared",
    shelfCoordinate: "D-38",
    isIncluded: false,
  },
  {
    id: "fly-04",
    code: "FLY-AMAZON-REVIEW",
    title: "Cartolina Ringraziamento Neutra (Amazon)",
    italianTitle: "Cartolina Neutra di Assistenza Clienti",
    shelfLocation: "N-B3",
    brand: "AMAZON_WHITE_LABEL",
    isIncluded: false,
  },
  {
    id: "fly-05",
    code: "FLY-WELCOME-SUB",
    title: "Guida all'uso quotidiano dell'olio Omega-3",
    italianTitle: "Benvenuto Abbonamento: Guida all'uso quotidiano",
    shelfLocation: "N-A8",
    brand: "NORSAN",
    shelfCoordinate: "N-A8",
    isIncluded: false,
  },
  {
    id: "fly-06",
    code: "FLY-RETEST",
    title: "Promemoria Secondo Test Omegametrix",
    italianTitle: "Misura di nuovo i tuoi acidi grassi",
    shelfLocation: "N-A8",
    brand: "NORSAN",
    shelfCoordinate: "N-A8",
    isIncluded: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// BOX TYPES (9 standard: 3 brands × 3 sizes)
// ─────────────────────────────────────────────────────────────────────────

// ─── Box Types ────────────────────────────────────────────────────────────
// 9 standard configurations: 3 brands × 3 sizes.
export const BOX_TYPES: {
  id: BoxType;
  name: string;
  barcode: string;
  maxWeight: number;
  branding: "norsan_logo" | "zreen_logo" | "neutral_unbranded";
  brandingLabel: string;
  badgeColor: string;
}[] = [
  // NORSAN
  {
    id: "BOX-NOR-S",
    name: "Scatola S • Logo NORSAN (1-2 flaconi)",
    barcode: "BOX-NOR-S",
    maxWeight: 800,
    branding: "norsan_logo",
    brandingLabel: "LOGO NORSAN",
    badgeColor: "bg-norsan-600 text-white",
  },
  {
    id: "BOX-NOR-M",
    name: "Scatola M • Logo NORSAN (Standard 2-4 flaconi)",
    barcode: "BOX-NOR-M",
    maxWeight: 2200,
    branding: "norsan_logo",
    brandingLabel: "LOGO NORSAN",
    badgeColor: "bg-norsan-600 text-white",
  },
  {
    id: "BOX-NOR-L",
    name: "Scatola L • Logo NORSAN (Fino a 8 flaconi)",
    barcode: "BOX-NOR-L",
    maxWeight: 5000,
    branding: "norsan_logo",
    brandingLabel: "LOGO NORSAN",
    badgeColor: "bg-norsan-600 text-white",
  },
  // ZREEN
  {
    id: "BOX-ZRE-S",
    name: "Scatola S • Logo ZREEN (1-2 integratori)",
    barcode: "BOX-ZRE-S",
    maxWeight: 800,
    branding: "zreen_logo",
    brandingLabel: "LOGO ZREEN (DOCCIARIA)",
    badgeColor: "bg-emerald-700 text-white",
  },
  {
    id: "BOX-ZRE-M",
    name: "Scatola M • Logo ZREEN (2-4 integratori)",
    barcode: "BOX-ZRE-M",
    maxWeight: 2200,
    branding: "zreen_logo",
    brandingLabel: "LOGO ZREEN (DOCCIARIA)",
    badgeColor: "bg-emerald-700 text-white",
  },
  {
    id: "BOX-ZRE-L",
    name: "Scatola L • Logo ZREEN (Grande)",
    barcode: "BOX-ZRE-L",
    maxWeight: 5000,
    branding: "zreen_logo",
    brandingLabel: "LOGO ZREEN (DOCCIARIA)",
    badgeColor: "bg-emerald-700 text-white",
  },
  // Amazon
  {
    id: "BOX-AMZ-S",
    name: "Scatola S • NEUTRA SENZA LOGO (Amazon)",
    barcode: "BOX-AMZ-S",
    maxWeight: 800,
    branding: "neutral_unbranded",
    brandingLabel: "NEUTRA SENZA LOGO (AMAZON)",
    badgeColor: "bg-amber-600 text-white",
  },
  {
    id: "BOX-AMZ-M",
    name: "Scatola M • NEUTRA SENZA LOGO (Amazon Standard)",
    barcode: "BOX-AMZ-M",
    maxWeight: 2200,
    branding: "neutral_unbranded",
    brandingLabel: "NEUTRA SENZA LOGO (AMAZON)",
    badgeColor: "bg-amber-600 text-white",
  },
  {
    id: "BOX-AMZ-L",
    name: "Scatola L • NEUTRA SENZA LOGO (Amazon Grande)",
    barcode: "BOX-AMZ-L",
    maxWeight: 5000,
    branding: "neutral_unbranded",
    brandingLabel: "NEUTRA SENZA LOGO (AMAZON)",
    badgeColor: "bg-amber-600 text-white",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// SellyErp service-line filter utility
// Filters out shipping/handling SKUs (e.g. "3000-001 - Spedizione")
// ─────────────────────────────────────────────────────────────────────────

// ─── SellyErp Service SKU Utilities ──────────────────────────────────────
// Service lines (Spedizione, etc.) must be filtered before building packing UI.
export const SERVICE_SKU_PREFIXES = ["3000-", "9000-", "SRV-"];

export function isSellyErpServiceSku(sku: string): boolean {
  return SERVICE_SKU_PREFIXES.some((prefix) => sku.startsWith(prefix));
}
