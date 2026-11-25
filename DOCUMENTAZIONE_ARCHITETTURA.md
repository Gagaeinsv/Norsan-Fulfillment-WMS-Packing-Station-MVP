# Architettura del Progetto — NORSAN & ZREEN Fulfillment WMS (Bolzano Hub)

Questo documento descrive la struttura aggiornata della codebase, le dipendenze tra i moduli e il funzionamento **Flusso Rapido 1-Scan** approvato per l'operatività di reparto di **NORSAN & ZREEN Fulfillment WMS**.

Per la guida operativa dedicata al backend (struttura SQLite, endpoint REST, configurazione `.env` e deploy Docker/Windows/Cloud), vedere [docs/BACKEND_DEPLOY_GUIDE.md](docs/BACKEND_DEPLOY_GUIDE.md).

---

## Struttura delle Directory

### `/src` (Frontend React 19 + TypeScript 6 + Tailwind CSS v4)

L'interfaccia adotta lo stile **Swiss-Light Industrial** (`#f4f6f9`, card bianche con bordi `1px`, font tabellare per codici e contatori, icone Lucide senza emoji decorative) ed è organizzata in moduli con responsabilità chiare:

#### `src/config/` (Controllo Fasi di Rilascio)
* **`wmsPhaseConfig.ts`**: Feature flag centralizzati tra **Fase 1 (Attiva in Produzione)** e **Fasi 2–4 (Congelate / in Roadmap)**:
  - `PHASE_1_PACKING_STATION_ONLY`: mantiene attiva l'operatività focalizzata sul banco d'imballaggio rapido e mostra la tab `Control Tower Roadmap` nella dashboard direzionale.
  - `ENABLE_FEFO_LOT_TRACKING`, `ENABLE_WAREHOUSE_INVENTORY_ERP`, `ENABLE_LEAN_ANALYTICS_TABS`: disattivati (`false`) fino alla validazione su dati reali di magazzino.

#### `src/components/` (Livello UI / Presentazione)
* **`/auth`**: Autenticazione e controllo accessi (`OperatorAuthModal.tsx`, `TerminalLockScreen.tsx`, `SupervisorPinModal.tsx`). Sblocco terminale tramite badge Code 128-B o PIN operatore; l'accesso alla Dashboard Team Lead richiede ruolo abilitato o PIN supervisore.
* **`/packing`**: Terminale operativo d'imballaggio (`ActivePackingView.tsx`, `PackingItemList.tsx`, `PackingItemCard.tsx`, `PackingBanners.tsx`):
  - Gestione dell'ordine attivo in **Flusso Rapido 1-Scan** (nessun blocco su scansione articolo), banner **conflitto blocco multi-banco** (`isLockedByOther`), promemoria visivi su volantini/omaggi/documenti B2B, selettore timing etichetta DHL (`on_scan` vs `on_finish`) e pulsanti sempre attivi **`Ristampa DHL`** / **`Completa & Prossimo`**.
* **`/queue`**: Coda ordini laterale (`OrderQueue.tsx`) con filtri canale (`Standard`, `Abbonamenti`, `B2B`, `Amazon`), badge di blocco multi-banco (`Tuo banco` oppure operatore/postazione che detiene il lock), stampa distinte A4 singole e batch.
* **`/rack`**: Mappa visiva dello scaffale a **5 livelli (`E, D, C, B, A`) + `TAVOLO`** dell'Hub di Bolzano (`StationRackGuide.tsx`, `RackSlotCell.tsx`, `RackSlotEditPanel.tsx`, `rackTypes.ts`) con supporto tavoli speculari (`STATION_01` vs `STATION_02`).
* **`/supervisor`**: Control Tower del Team Lead (`SupervisorDashboard.tsx`, `SlottingManager.tsx`):
  - KPI turno in tempo reale (postazioni attive, completati, coda, UPH, anomalie aperte).
  - Tab **`Postazioni`**: monitoraggio banchi e pannello **Blocchi Ordini Attivi (Multi-Banco)** con **`Sblocca (Force Release)`** immediato.
  - Tab **`Selly Web-Shop`** & **`Amazon FBM`**: code dedicate, stampa distinte A4 con Code 128-B, correzione indirizzi e modali credenziali API.
  - Tab **`Operatori & Badge`**: anagrafica staff, stampa badge e gestione PIN.
  - Tab **`Anomalie & Kanban`**: ricezione e chiusura segnalazioni dalle postazioni (persistite su SQLite).
  - Tab **`Gestione Scaffali & Slotting (5S)`**: assegnazione SKU alle celle, foto personalizzate e reset topologia.
  - Tab **`Control Tower Roadmap`**: 6 moduli enterprise (con **`Order Locking & Force Release`** contrassegnato come **`Attivo nel Nucleo`** e collegato alla gestione reale dei blocchi; i restanti 5 moduli mostrano anteprime simulate di Roadmap).
* **`/shared`**: Modali trasversali (`SellyCsvModal.tsx` import CSV Zero-API da Selly ERP, `AddressFixModal.tsx` correzione assistita indirizzi italiani, `BarcodeBindModal.tsx` associazione opzionale nuovi EAN condivisa tra i terminali).
* **`/layout`**: Intestazione industriale (`Header.tsx`, `ScannerStatusBanner.tsx`) con selettore postazione speculare e menu utility.
* **`/dev`**: Simulatore pistola barcode (`BarcodeSimulator.tsx`) e modulo segnalazione anomalie Kanban (`IssueReportModal.tsx`).
* **`/shipping`**: Flusso riepilogo spedizione (`ShippingLabelModal.tsx`) con supporto **Multi-Collo**, calcolo peso lordo stimato e contenitore stampa termica `100×150 mm`.

#### `src/hooks/` (Livello di Business Logic Frontend)
* **`useWarehouseState.ts`**: Orchestratore globale dell'applicazione:
  - Alla scansione della bolla (`matchedOrder`), chiude automaticamente l'eventuale ordine precedente del banco, acquisisce il **lock atomico multi-banco**, compila gli articoli/allegati dell'ordine per zero attese e avvia la stampa termica DHL (`on_scan` di default).
  - Gestisce **Order Locking & Force Release** (`handleSelectOrder`, `handleForceUnlockOrder`, blocco duplicati su altri banchi, rilascio al blocco terminale o al completamento).
  - Scansione di singoli prodotti disponibile in modo opzionale/non bloccante con eventuale segnalazione articolo errato e log audit.
  - Sincronizzazione live multi-postazione ogni 5 secondi con **protezione delle modifiche recenti (`lastMutationByOrderRef`, finestra 4s)**.
  - Persistenza condivisa di **anomalie Kanban**, **associazioni barcode custom** e **audit log** su backend SQLite con fallback locale resiliente.
* **`useBarcodeScanner.ts`**: Intercettazione globale dello scanner HID USB/Bluetooth (emulazione tastiera) con esclusione automatica degli input nelle modali bloccanti (eccetto classi `scanner-friendly`).
* **`useSoundEffects.ts`**: Sintesi sonora nativa tramite Web Audio API (nessuna dipendenza esterna).

#### `src/services/` (Servizi Frontend & Stampanti)
* **`api.ts`**: Client REST verso `VITE_API_BASE` (default `http://<host>:3001/api`) con metodi per lock/unlock (`409 Conflict` / `403`), checklist, indirizzi, anomalie Kanban, associazioni barcode condivise e audit log, più fallback trasparente su `localStorage`.
* **`barcodeGenerator.ts`**: Codificatore **Code 128-B** SVG nativo (Start B `104`, checksum mod 103, Stop `106`).
* **`orderSlipPrinter.ts` & `amazonSlipPrinter.ts`**: Generatori distinte A4 singole e batch per Selly e Amazon FBM.
* **`dhlLabelPrinter.ts`**: Generatore etichette termiche A6 `100×150 mm` (singolo/multi-collo; usa tracking simulato `JJD...` finché `DHL_API_KEY` non è collegata).
* **`sellyCsvImporter.ts`**: Parser CSV Selly ERP (`;` / `,` / `Tab`, gestione BOM), filtro righe di servizio (`3000-001`, incassi) e risoluzione alias catalogo.
* **`italianAddressParser.ts`**: Parser indirizzi italiani (`street`, `houseNumber`, `addressAddition`).
* **`p2lClient.ts`**: Client HTTP verso le API Pick-to-Light del backend.
* **`lotTraceabilityService.ts` & `mainWarehouseInventoryService.ts`**: Servizi di dominio per Fase 2–3 (FEFO e stock pallet/scaffale), attualmente disattivati da `wmsPhaseConfig.ts`.

#### `src/data/` (Catalogo & Configurazioni)
* **`norsanProducts.ts` & `products/*.ts`**: Catalogo NORSAN & ZREEN con EAN-13, alias di lotto, pesi e coordinate Hub Bolzano.
* **`marketingFlyers.ts`**: Configurazione volantini marketing e 9 formati scatola (`BOX-NOR-*`, `BOX-ZRE-*`, `BOX-AMZ-*`).

---

### `/server` (Backend Node.js / Express 5 / Better-SQLite3)

* **`index.ts`**: Server REST API sulla porta `3001` (configurabile via `PORT`) con:
  - Catalogo & Slotting 5S (`/api/products`, `/api/slots`, `/api/slotting/assign`, `/api/slots/add`, `/api/slots/:slotCode`).
  - Operatori & Verifica PIN/Badge (`/api/operators`, `/api/operators/verify`, CRUD operatori).
  - Ordini & Multi-Banco (`/api/orders`, `/api/orders/bulk`, `/api/orders/:id/lock`, `/api/orders/:id/unlock`, `/api/orders/:id/status`, `/api/orders/:id/checklist`, `/api/orders/:id/address`, `/api/orders/:id/item`, `/api/orders/:id/box`, `/api/orders/:id/package-count`, `/api/orders/:id`, `/api/orders/clear-packed`).
  - Anomalie Kanban (`/api/issues`, `/api/issues/:id/resolve`), Associazioni Barcode Condivise (`/api/barcode-bindings`), Audit Scansioni (`/api/audit/scan`, `/api/audit/summary`), Stato Integrazioni & Outbox (`/api/integrations/status`).
  - Pick-to-Light (`/api/p2l/*`), Selly Config (`/api/selly/*`), Health (`/api/health`), più handler centralizzato errori JSON (`400` senza stack trace).
* **`db.ts`**: Database SQLite (`server/data/wms.sqlite` in produzione, `:memory:` nei test) con **14 tabelle**, migrazioni idempotenti per colonna su `orders` (lock con TTL 15 min, indirizzo JSON, timestamp inizio/fine imballaggio), coda `api_outbox` e seed iniziale operatori/slot/scatole/volantini.
* **`services/carrierService.ts`**: Astrazione plug-and-play `CarrierProvider` (`MockDhlCarrierProvider` attivo in assenza di credenziali + predisposizione `DhlBusinessApiProvider` pilotata da `.env`) e stato integrazioni `getIntegrationsReadiness()` (`dhl`, `selly`, `amazon`).
* **`services/sellySyncService.ts`**: Daemon polling configurabile per importazione automatica da Selly ERP REST API (richiede `SELLY_API_KEY`).
* **`services/p2lService.ts`**: Driver HTTP per controller **ESP32 Pick-to-Light** con fallback automatico offline/mock.
* **`tests/`**: 6 suite attive (29 test totali passati: `api.test.ts`, `hardening.test.ts`, `p2l.test.ts`, `sellyCsvImporter.test.ts`, `catalogIntegrity.test.ts`, `productionReadiness.test.ts`) + `domainServicesAndAuditFixes.test.ts` per i servizi congelati di Fase 2–3.

---

## Flusso Logico Operativo (1-Scan Fast Packing)

1. **Autenticazione & RBAC**: L'operatore sblocca il terminale tramite badge Code 128-B o PIN. L'accesso alla Dashboard Team Lead è protetto da ruolo o PIN dedicati. Se l'operatore blocca il terminale (`Lock`), il lock dell'eventuale ordine aperto viene rilasciato automaticamente.
2. **Acquisizione Ordini & Normalizzazione Indirizzi**: Gli ordini arrivano in coda da Selly ERP (Upload CSV Zero-API oppure API REST quando configurata) e Amazon FBM. Il parser segnala indirizzi italiani incompleti prima della spedizione e salva eventuali correzioni del Team Lead (`PATCH /api/orders/:id/address`).
3. **1-Scan Bolla → Blocco Multi-Banco → Stampa Immediata DHL**:
   - L'operatore scansiona il barcode della bolla A4: il sistema verifica il lock atomico (`POST /api/orders/:id/lock`, rifiuta con `409 Conflict` se già preso su un altro tavolo), chiude l'eventuale ordine precedente sul proprio banco e avvia **immediatamente la stampa dell'etichetta termica DHL `100×150 mm`** (multi-collo automatico se `>10` unità o tramite barcode tavolo `+COLLO`).
4. **Prelievo Rapido con Guida Visuale (Nessuna Scansione Obbligatoria Flaconi)**:
   - Lo schermo mostra foto prodotto, posizione sullo scaffale speculare a 5 piani (`Sinistra / Destra / Tavolo`), tipo scatola (**NORSAN vs Neutra Amazon**) e promemoria volantini/omaggi/B2B.
   - La scansione del singolo codice EAN resta opzionale (utile per verificare nuovi lotti o associare barcode sconosciuti).
5. **Chiusura & Coda Outbox (`api_outbox`)**: Alla scansione della bolla successiva o al clic su **`Completa & Prossimo`**, il backend rilascia il lock, registra `packing_completed_at` e inserisce l'ordine in `api_outbox` (`pending_api`) pronto per il ritorno automatico dei tracking verso Selly ERP e Amazon SP-API non appena le credenziali ufficiali saranno inserite in `.env`.

---

## Requisiti Registrati per Fase 2 — Fatture Consolidate Multi-Ordine & Brand `foten`

1. **Fatture Consolidate Multi-Ordine (`Progressivo ordine cliente 1, 2...`):**
   - **Caso reale Bolzano:** un unico documento cartaceo per lo stesso destinatario può contenere più ordini provenienti da siti diversi con codici a barre separati (es. `INT55813` per ZREEN `5000-097` + `IT101778` per NORSAN `1000-002`, includendo il prefisso `IT...` oltre a `INT...` e `ORDVE...`).
   - **Regola operativa:** gli ordini sullo stesso foglio vengono sempre confezionati insieme in **1 sola scatola con 1 sola etichetta DHL**.
   - **Specifica tecnica prevista in Fase 2:** modello `1 spedizione = N linkedOrderNumbers` (`barcodes[]`). La scansione di qualsiasi codice a barre del foglio apre l'ordine unificato mostrando tutti gli articoli e i volantini previsti e stampa **1 sola etichetta DHL**; la scansione del secondo codice a barre sullo stesso documento non genera una seconda etichetta; `api_outbox` propaga lo stesso numero di tracking DHL verso **tutti** gli ordini collegati su Selly ERP.

2. **Terzo Canale / Brand `foten`:**
   - Nuovo sito e-commerce (`foten`) affiancato ai canali esistenti `NORSAN` e `ZREEN`.
   - **Regole operative confermate:** nessuna scatola brandizzata dedicata, **volantino promozionale dedicato presente**, anagrafica SKU `foten` da importare e mappare dal catalogo completo Selly ERP in Fase 2 (oggi `src/data/products/` censisce esclusivamente SKU NORSAN e ZREEN).

