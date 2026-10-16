# 📦 NORSAN & ZREEN Fulfillment WMS — Packing Station (Bolzano Hub)

Sistema operativo di magazzino (**WMS Packing Station & Supervisor Control Tower**) progettato per l'Hub logistico **NORSAN S.r.l. / ZREEN** di Bolzano (Alto Adige, Italia).

Sostituisce i processi manuali e i software intermediari esterni a pagamento (es. connettori FBM di terze parti) con un'unica interfaccia industriale ad alta velocità, conforme agli standard **Lean 5S**, **Poka-Yoke** (zero errori di spedizione) e **Pick-to-Light**.

---

## 🎯 Obiettivi di Business & Valore Operativo

1. **Zero Errori di Confezionamento (Poka-Yoke Attivo)**
   - Verifica rigorosa tramite scanner hardware USB/Bluetooth (EAN-13, UPC-12, codici interni ed etichette fornitore).
   - Blocco automatico della stampa etichetta corriere finché non sono confermati: **Articoli**, **Volantino Marketing**, **Omaggio Fedeltà** (es. cucchiaino dosatore / card sconto 15%) e **Fattura/DDT Cartaceo B2B**.
   - Associazione istantanea (**1-Click Barcode Binding**) per nuovi lotti o codici fornitore non ancora censiti a catalogo.

2. **Doppio Flusso Operativo: Paperless (Pick-to-Light) & Prelievo da Bolla Cartacea**
   - **Modalità Paperless / Pick-to-Light**: scansione diretta articolo per articolo con illuminazione LED sugli scaffali (ESP32 WS2812B) e supporto **Cartone Master** (`+6` / `+12` pz).
   - **Modalità Prelievo da Bolla (`Conferma Prelievo da Bolla`)**: validazione rapida degli articoli prelevati con distinta cartacea A4, mantenendo intatto il controllo Poka-Yoke su volantini, omaggi e documenti fiscali.

3. **Integrazione Diretta Amazon FBM & Selly ERP (Zero Costi di Middleware)**
   - **Modulo Amazon FBM Diretto**: generazione e stampa batch di **Distinte di Prelievo A4** con codici a barre **Code 128-B reali** (leggibili da qualsiasi pistola laser/2D) e regola automatica **Scatola Neutra senza logo (`BOX-AMZ-*`)**.
   - **Sincronizzazione Selly ERP**: importazione ordini tramite **API REST (Daemon automatico)** o **Upload CSV/PDF** con filtro automatico delle righe di servizio (`3000-001 Spedizione`, spese incasso, ecc.).

4. **Normalizzatore Indirizzi Italiani per Corrieri (DHL / BRT)**
   - Motore intelligente (`italianAddressParser.ts`) che separa automaticamente via/piazza, numero civico (`snc`, `12/A`, `km`) ed estensioni (`piano`, `scala`, `interno`, `citofono`, `presso`) evitando blocchi nella generazione delle lettere di vettura DHL.

5. **Topologia Reale Hub Bolzano a 5 Livelli (Tavoli Speculari)**
   - Mappa interattiva a **5 livelli verticali (`E, D, C, B, A`)** per gli scaffali **NORSAN (`S`)** e **ZREEN (`D`)**, più postazione tavolo (`TAVOLO`).
   - Supporto nativo per **Tavoli Speculari** (`Stazione 1` vs `Stazione 2`) con inversione automatica sinistra/destra della guida visiva.

---

## 🏗️ Architettura Tecnica

| Livello | Tecnologie | Descrizione |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript 6, Vite 8, Tailwind CSS v4 | Interfaccia touch & scanner-first per le postazioni di imballaggio e Dashboard Team Lead. |
| **Barcode Engine** | `barcodeGenerator.ts` (Code 128-B) | Generatore nativo SVG Code 128-B con checksum modulo 103 per bolle A4, etichette DHL A6 e badge operatori. |
| **Backend API** | Node.js, Express 5, Better-SQLite3 | API REST locale per persistenza slotting 5S, audit log delle scansioni, sync Selly ERP e controllo Pick-to-Light. |
| **Hardware IoT** | HTTP Controller ESP32-WROOM-32 | Pilotaggio strisce LED indirizzabili WS2812B sugli scaffali con fallback automatico offline/mock. |
| **Quality Assurance** | Vitest 5 & Supertest | 25 test automatici su integrità catalogo, importatore CSV Selly, API REST, validazione sicurezza e Pick-to-Light. |

---

## 📂 Struttura Principale del Repository

```text
├── src/
│   ├── components/
│   │   ├── auth/          # Kiosk Lock Screen, Badge Login, PIN Supervisore (RBAC)
│   │   ├── layout/        # Header industriale con stato scanner live e KPI
│   │   ├── packing/       # Terminale operativo ordine attivo, card articoli e banner Poka-Yoke
│   │   ├── queue/         # Coda ordini con filtri canale (Web, Amazon FBM, B2B, Selly ERP)
│   │   ├── rack/          # Mappa interattiva 5 livelli Hub Bolzano e guida tavoli speculari
│   │   ├── shared/        # Modali CSV Selly, Normalizzatore Indirizzi IT, Associazione Barcode
│   │   ├── shipping/      # Etichetta termica DHL Express A6 (Multi-collo + Code 128-B)
│   │   └── supervisor/    # Control Tower Team Lead (Stazioni, Amazon FBM, E-Commerce, Slotting 5S, Lean KPI)
│   ├── data/
│   │   ├── products/      # Catalogo reale NORSAN & ZREEN (>100 SKU con EAN, pesi e slot Bolzano)
│   │   ├── marketingFlyers.ts
│   │   ├── mockOperators.ts
│   │   └── mockOrders.ts
│   ├── hooks/
│   │   ├── useWarehouseState.ts  # State orchestrator, motore di scansione e regole Poka-Yoke
│   │   ├── useBarcodeScanner.ts  # Intercettazione globale scanner USB/Bluetooth (HID Keyboard)
│   │   └── useSoundEffects.ts    # Sintesi sonora Web Audio API (zero dipendenze esterne)
│   └── services/
│       ├── barcodeGenerator.ts      # Codificatore standard Code 128-B SVG
│       ├── amazonSlipPrinter.ts     # Generatore Distinte di Prelievo A4 (singole e batch)
│       ├── sellyCsvImporter.ts      # Parser CSV Selly ERP con filtro servizi e match catalogo
│       ├── italianAddressParser.ts  # Parser indirizzi italiani (Via / Civico / Piano / Scala)
│       ├── p2lClient.ts             # Client Pick-to-Light frontend
│       └── api.ts                   # Client API con fallback resiliente su localStorage
└── server/
    ├── index.ts                     # Server Express REST API (/api/products, /api/slots, /api/p2l, /api/selly)
    ├── db.ts                        # Schema e seed SQLite
    ├── services/
    │   ├── p2lService.ts            # Driver HTTP per controller ESP32 Pick-to-Light
    │   └── sellySyncService.ts      # Daemon di sincronizzazione automatica Selly ERP
    └── tests/                       # Suite di test automatici (Vitest)
```

---

## 🚀 Avvio Rapido (Sviluppo & Postazione Locale)

### 1. Installazione dipendenze
```bash
npm install
```

### 2. Avvio completo (Frontend + Backend SQLite/P2L)
```bash
npm run dev
```
- ** Postazione WMS (Frontend)**: `http://localhost:5173`
- ** Server API Locale**: `http://localhost:3001/api/health`

### 3. Esecuzione Test e Build di Produzione
```bash
# Verifica tipi TypeScript e build di produzione
npm run build

# Esecuzione suite di test automatici (25 test)
npm run test:backend
```

---

## 🔐 Ruoli e Sicurezza (RBAC)

- **Packer (Operatore Imballaggio)**: accesso diretto tramite scansione badge (`OP-042`, `OP-018`, ecc.) alla vista operativa di confezionamento.
- **Team Lead / Supervisore**: accesso protetto da **PIN a 4 cifre** (default demo: `1234` o scansione badge `TL-001`) alla **Dashboard Direzionale**, configurazione Slotting 5S, stampa batch Amazon FBM e normalizzazione indirizzi bloccati.
