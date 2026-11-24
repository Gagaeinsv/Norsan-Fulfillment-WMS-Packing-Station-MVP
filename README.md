# 🚨 STRUMENTO DI EMERGENZA: FILTRO ORDINI SELLY / DHL (BOLZANO HUB)

> ### ⚡ ACCESSO RAPIDO PER IL MAGAZZINO:
> 👉 **[CLICCA QUI PER APRIRE IL FILTRO PDF ONLINE](https://raw.githack.com/Gagaeinsv/Norsan-Fulfillment-WMS-Packing-Station-MVP/main/dhl.html)** 👈
>
> In alternativa: scarica [`dhl.html`](https://raw.githubusercontent.com/Gagaeinsv/Norsan-Fulfillment-WMS-Packing-Station-MVP/main/dhl.html) e aprilo con doppio clic in Google Chrome.
>
> **Cosa fa**: Esclude gli ordini già spediti oggi su DHL, elimina le copie duplicate/triplicate di Selly ERP e genera il PDF pulito con **SOLI NUOVI ORDINI** da stampare e imballare.

---

# 📦 NORSAN & ZREEN Fulfillment WMS — Packing Station (Bolzano Hub)

Sistema operativo di magazzino (**WMS Packing Station & Supervisor Control Tower**) progettato per l'Hub logistico **NORSAN S.r.l. / ZREEN** di Bolzano (Alto Adige, Italia).

Sostituisce i processi manuali e i software intermediari esterni a pagamento con un'interfaccia **Swiss-Light Industrial** veloce ed essenziale: **1 scansione sulla bolla per aprire l'ordine, bloccarlo sul banco e stampare subito l'etichetta DHL**, senza rallentare l'operatore con scansioni obbligatorie dei singoli flaconi.

> **Documentazione dedicata:**
> - [DOCUMENTAZIONE_ARCHITETTURA.md](DOCUMENTAZIONE_ARCHITETTURA.md) — Mappa completa dei moduli frontend/backend e flusso operativo
> - [docs/BACKEND_DEPLOY_GUIDE.md](docs/BACKEND_DEPLOY_GUIDE.md) — **Guida al Backend (SQLite, REST API, `.env` e deploy Docker/Windows/Cloud)**

---

## 🎯 Funzionalità Operative Attive (Fase 1 + Nucleo Multi-Banco)

1. **Flusso Rapido 1-Scan: Bolla → Stampa Immediata DHL (Zero Rallentamenti)**
   - Scansionando il codice a barre della bolla cartacea, il WMS carica l'ordine, segna automaticamente la distinta pronta e lancia **immediatamente l'etichetta termica DHL `100×150 mm`** (`on_scan` di default, o `on_finish` su scelta dell'operatore).
   - **Nessuna scansione obbligatoria dei singoli prodotti**: la scansione EAN resta disponibile come controllo opzionale non bloccante (con eventuale audit su `scan_audit_logs`), mentre comandi da tavolo (`+COLLO`, `PRINT-DHL`) gestiscono colli multipli e ristampe senza mouse.

2. **Protezione Multi-Banco (Order Locking & Force Release)**
   - Lock atomico degli ordini in SQLite (`POST /api/orders/:id/lock`, TTL 15 min): se un secondo banco prova a prendere o scansionare un duplicato della stessa bolla, riceve **`409 Conflict`** e **non stampa una seconda etichetta DHL**.
   - Rilascio automatico al cambio ordine, al completamento o al blocco terminale, più **Force Release** in 1 clic per il Team Lead dalla tab `Postazioni`.
   - Sincronizzazione live ogni 5 secondi tra i terminali con protezione delle modifiche locali recenti (finestra 4s).

3. **Guida Visuale a 5 Livelli & Regole Canale (NORSAN vs Amazon Neutra)**
   - Mappa interattiva **5 piani (`E, D, C, B, A`) + `TAVOLO`** per **NORSAN (`S`)** e **ZREEN (`D`)**, con inversione automatica sinistra/destra per tavoli speculari (`STATION_01` / `STATION_02`) per trovare i flaconi a colpo d'occhio.
   - Promemoria visivi per **Scatola Neutra senza logo (`BOX-AMZ-*`)** su ordini Amazon FBM, eventuali volantini promozionali, omaggi clienti fedeli e documenti cartacei B2B, più segnalazioni rapide Kanban (`/api/issues`).

4. **Normalizzatore Indirizzi Italiani & Multi-Collo (`+COLLO`)**
   - Parser dedicato (`Via / Civico / Piano / Scala / Int.`) che individua e corregge gli indirizzi italiani problematici prima dell'invio al corriere, salvando le correzioni su SQLite (`PATCH /api/orders/:id/address`).
   - Calcolo automatico colli per ordini voluminosi e aggiunta scatole aggiuntive con barcode sequenziale.

5. **Integrazione Selly ERP & Predisposizione API DHL / Amazon (`api_outbox`)**
   - Importazione ordini da **Selly ERP via CSV (Zero-API)** con filtro automatico delle righe di servizio (`3000-001 Spedizione`, incassi, sconti) e daemon REST pronto per `SELLY_API_KEY`.
   - Adapter `CarrierProvider` (`server/services/carrierService.ts`) e coda `api_outbox` pronti per attivare tracking ufficiali DHL, Selly e Amazon SP-API inserendo le credenziali in `.env` senza riscrivere il nucleo.
   - Tab **`Control Tower Roadmap`** con i moduli enterprise previsti per le fasi successive (`Cutoff DHL & SLA`, `Audit Heatmap`, `Borderò EOD`, `Resi RMA`, `FEFO HACCP & Stock 2-Livelli` attualmente congelati in `src/config/wmsPhaseConfig.ts`).

---

## 🏗️ Architettura Tecnica

| Livello | Tecnologie | Descrizione |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript 6, Vite 8, Tailwind CSS v4 | Interfaccia touch & scanner-first Swiss-Light Industrial per postazioni di imballaggio e Control Tower Team Lead. |
| **Barcode Engine** | `barcodeGenerator.ts` (Code 128-B) | Generatore nativo SVG Code 128-B con checksum modulo 103 per bolle A4, etichette A6 e badge operatori. |
| **Backend API** | Node.js 20+, Express 5, Better-SQLite3 | REST API locale/rete con SQLite a 14 tabelle (`orders` lock + address, `issues`, `barcode_bindings`, `api_outbox`, `scan_audit_logs`, slotting 5S, operatori). |
| **Hardware IoT** | HTTP Controller ESP32-WROOM-32 | Pilotaggio strisce LED indirizzabili WS2812B con fallback automatico offline/mock. |
| **Quality Assurance** | Vitest 5 & Supertest | 29 test automatici attivi (6 suite) su integrità catalogo, importatore CSV Selly, API REST, sicurezza, Pick-to-Light, Order Locking e outbox. |

---

## 📂 Struttura Principale del Repository

```text
├── .env.example                       # Template variabili d'ambiente per backend, API corriere/ERP e ESP32
├── Dockerfile & docker-compose.yml    # Containerizzazione backend Node + volume persistente SQLite
├── docs/
│   ├── BACKEND_DEPLOY_GUIDE.md        # Guida completa al backend e alle opzioni di deploy
│   └── VISIONE_E_ROADMAP_ECOSISTEMA_MAGAZZINO_IT.md
├── src/
│   ├── config/
│   │   └── wmsPhaseConfig.ts          # Feature flag Fase 1 attiva vs Fasi 2–4 congelate
│   ├── components/
│   │   ├── auth/                      # Kiosk Lock Screen, Badge Login, PIN Supervisore
│   │   ├── layout/                    # Header industriale con stato scanner live e KPI
│   │   ├── packing/                   # Terminale ordine attivo, card articoli e alert blocco multi-banco
│   │   ├── queue/                     # Coda ordini con filtri canale e badge stato lock per banco
│   │   ├── rack/                      # Mappa interattiva 5 livelli Hub Bolzano e tavoli speculari
│   │   ├── shared/                    # Modali CSV Selly, Indirizzi IT, Associazione Barcode
│   │   ├── shipping/                  # Etichetta termica A6 (Multi-collo + Code 128-B)
│   │   └── supervisor/                # Control Tower Lead (Postazioni + Force Release, Slotting 5S, Roadmap)
│   ├── data/products/                 # Catalogo reale NORSAN & ZREEN (EAN, alias, pesi, slot Bolzano)
│   ├── hooks/                         # useWarehouseState (Order Lock + sync guard), useBarcodeScanner, useSoundEffects
│   └── services/                      # api.ts (fallback localStorage), stampanti A4/A6, CSV parser, Indirizzi IT
└── server/
    ├── index.ts                       # Server Express REST API (porta 3001)
    ├── db.ts                          # Schema SQLite (14 tabelle + migrazioni) e seed iniziale
    ├── services/
    │   ├── carrierService.ts          # Adapter plug-and-play Corriere (Mock / DHL API) + Readiness API
    │   ├── p2lService.ts              # Driver HTTP per controller ESP32 Pick-to-Light
    │   └── sellySyncService.ts        # Daemon di sincronizzazione automatica Selly ERP
    └── tests/                         # Suite Vitest (6 suite attive = 29 test + suite moduli congelati)
```

---

## 🚀 Avvio Rapido (Sviluppo & Postazione Locale)

### 1. Installazione dipendenze e configurazione
```bash
npm install
cp .env.example .env
```

### 2. Avvio completo (Frontend Vite + Backend SQLite/API)
```bash
npm run dev
```
- **Postazione WMS (Frontend)**: `http://localhost:5173`
- **Server API Locale (Health)**: `http://localhost:3001/api/health`
- **Stato Integrazioni API**: `http://localhost:3001/api/integrations/status`

Per deploy persistente in reparto via Docker o servizio locale Windows (con multi-banco su LAN), consultare [docs/BACKEND_DEPLOY_GUIDE.md](docs/BACKEND_DEPLOY_GUIDE.md).

### 3. Esecuzione Test e Build di Produzione
```bash
# Verifica tipi TypeScript e build di produzione
npm run build

# Esecuzione delle 6 suite attive di Fase 1 + Multi-Banco (29 test)
npx vitest run server/tests/api.test.ts server/tests/hardening.test.ts server/tests/p2l.test.ts server/tests/sellyCsvImporter.test.ts server/tests/catalogIntegrity.test.ts server/tests/productionReadiness.test.ts
```

---

## 🔐 Ruoli e Credenziali Demo Seed (RBAC)

I valori predefiniti creati in `server/db.ts` al primo avvio (modificabili dalla tab `Operatori & Badge` del Team Lead) sono:

- **Packer (Operatori Imballaggio)**:
  - `OP-01` (PIN `0001`, banco `ST-01`)
  - `OP-02` (PIN `0002`, banco `ST-02`)
  - `OP-03` (PIN `0003`, banco `ST-03`)
- **Team Lead / Supervisore**:
  - `TL-01` (PIN `7429`, `SUP-HUB`) — sblocca Control Tower direzionale, Force Release ordini bloccati, Slotting 5S, stampa batch Amazon FBM e gestione operatori.
