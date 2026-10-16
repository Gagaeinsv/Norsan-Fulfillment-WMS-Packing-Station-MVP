# Architettura del Progetto - NORSAN & ZREEN Fulfillment WMS (Bolzano Hub)

Questo documento descrive la struttura completa della codebase, le dipendenze tra i moduli e il funzionamento interno dell'applicazione **NORSAN & ZREEN Fulfillment WMS**.

---

## 📂 Struttura delle Directory

### `/src` (Frontend React 19 + TypeScript + Tailwind CSS v4)
L'architettura è modulare e basata sul principio di Single Responsibility:

#### `src/components/` (Livello UI / Presentazione)
* **`/auth`**: Componenti per l'autenticazione e il controllo accessi RBAC (`OperatorAuthModal.tsx`, `TerminalLockScreen.tsx`, `SupervisorPinModal.tsx`). Impedisce l'accesso non autorizzato alla Dashboard Supervisore senza PIN o badge Team Lead.
* **`/packing`**: Il cuore operativo (`ActivePackingView.tsx`, `PackingItemCard.tsx`, `PackingBanners.tsx`). Gestisce la visualizzazione dell'ordine attivo, lo stato di scansione, la conferma rapida da bolla cartacea e i blocchi Poka-Yoke (articoli, volantini, omaggi fedeltà, documenti B2B).
* **`/queue`**: Gestione della coda ordini (`OrderQueue.tsx`) con filtri rapidi per canale e stato.
* **`/rack`**: Mappa visiva dello scaffale a **5 livelli (`E, D, C, B, A`)** dell'Hub di Bolzano (`StationRackGuide.tsx`, `RackSlotCell.tsx`, `RackSlotEditPanel.tsx`) con inversione speculare automatica tra Stazione 1 e Stazione 2.
* **`/supervisor`**: Control Tower del Team Lead (`SupervisorDashboard.tsx`, `SlottingManager.tsx`). Include:
  - Monitoraggio Stazioni & KPI Lean in tempo reale
  - **Tab dedicata Amazon FBM** con stampa Distinte di Prelievo A4 (singole e batch) e configurazione SP-API
  - **Tab Ordini E-Commerce & Selly ERP** con normalizzazione indirizzi italiani
  - Configuratore **Slotting 5S** e stampa Badge Operatori con codice a barre Code 128-B
* **`/shared`**: Modali trasversali (`SellyCsvModal.tsx` per importazione CSV/PDF da Selly ERP, `AddressFixModal.tsx` per la correzione assistita degli indirizzi italiani, `BarcodeBindModal.tsx` per associare nuovi EAN/codici fornitore al volo).
* **`/layout`**: Componenti strutturali (`Header.tsx`, `ScannerStatusBanner.tsx`).
* **`/dev`**: Strumenti di simulazione e segnalazione anomalie (`BarcodeSimulator.tsx`, `IssueReportModal.tsx`).
* **`/shipping`**: Flusso di fine imballaggio (`ShippingLabelModal.tsx`) con supporto **Multi-Collo**, calcolo peso lordo automatico e codice a barre **Code 128-B** reale per il tracking DHL.

#### `src/hooks/` (Livello di Business Logic)
* **`useWarehouseState.ts`**: Global State Orchestrator dell'applicazione. Gestisce ordini, operatori, postazioni, KPI, regole Poka-Yoke, persistenza locale e sincronizzazione con il backend.
* **`useBarcodeScanner.ts`**: Intercetta gli input fisici dello scanner hardware USB/Bluetooth (modalità emulazione tastiera HID) e si mette automaticamente in pausa quando una finestra modale blocca lo schermo.
* **`useSoundEffects.ts`**: Genera feedback audio sintetizzati (Web Audio API) per scansioni valide, completamento riga, errori Poka-Yoke e completamento ordine.

#### `src/services/` (Servizi & Motori di Dominio)
* **`barcodeGenerator.ts`**: Codificatore **Code 128-B** standard (Start Code B `104`, checksum modulo 103, Stop Code `106`) che produce SVG nativi leggibili da pistole barcode fisiche.
* **`amazonSlipPrinter.ts`**: Generatore di **Distinte di Prelievo & Spedizione A4** (singole e multi-ordine) con barcode Code 128-B e avvisi obbligatori per scatole neutre Amazon FBM.
* **`sellyCsvImporter.ts`**: Motore di importazione CSV da Selly ERP con rilevamento automatico del delimitatore, filtro intelligente delle righe di servizio (`3000-001 Spedizione`, spese incasso, ecc.) e risoluzione SKU/EAN/alias + associazioni personalizzate.
* **`italianAddressParser.ts`**: Normalizzatore di indirizzi italiani che separa automaticamente `street` (Via/Corso/Piazza), `houseNumber` (civico, `snc`, `km`) e `addressAddition` (`piano`, `scala`, `interno`, `citofono`, `c/o`).
* **`p2lClient.ts`**: Client asincrono per l'invio dei comandi luminosi al server Pick-to-Light.
* **`api.ts`**: Livello di astrazione per le chiamate API REST con protezione del catalogo a 5 livelli di Bolzano e fallback su `localStorage`.

#### `src/data/` (Catalogo Reale & Configurazioni)
* **`norsanProducts.ts` & `products/*.ts`**: Catalogo completo NORSAN e ZREEN (>100 referenze) con EAN-13 ufficiali, alias di lotto, pesi e coordinate scaffale a 5 livelli (`S-E..S-A`, `D-E..D-A`, `TAVOLO`).
* **`marketingFlyers.ts`**: Configurazione dei volantini marketing e delle scatole (`BOX-NOR-*`, `BOX-ZRE-*`, `BOX-AMZ-*`).

---

### `/server` (Backend Node.js / Express 5 / SQLite)
* **`index.ts`**: Server REST API con validazione rigorosa degli input, gestione errori JSON sicura (senza leak di stack trace) ed endpoint `/api/products`, `/api/slots`, `/api/slotting/assign`, `/api/audit/scan`, `/api/p2l/*`, `/api/selly/*` e `/api/health`.
* **`db.ts`**: Gestione database SQLite (`better-sqlite3`) con persistenza delle modifiche di slotting tra i riavvii.
* **`services/p2lService.ts`**: Driver HTTP per il controller **ESP32 Pick-to-Light** con deduplicazione dei ping concorrenti e modalità mock automatica se il controller è offline.
* **`services/sellySyncService.ts`**: Daemon di sincronizzazione periodica verso Selly ERP con trasformazione automatica degli articoli in `OrderItem` e parsing degli indirizzi.
* **`tests/`**: 5 suite di test Vitest (`api.test.ts`, `hardening.test.ts`, `p2l.test.ts`, `sellyCsvImporter.test.ts`, `catalogIntegrity.test.ts` — 25 test totali).

---

## ⚙️ Flusso Logico Operativo

1. **Autenticazione & RBAC**: L'operatore sblocca il terminale scansionando il proprio badge Code 128-B. I Packer accedono esclusivamente al terminale di imballaggio; l'accesso alla Dashboard Supervisore richiede il ruolo Team Lead o l'inserimento del PIN.
2. **Acquisizione Ordini (API / CSV / Bolla A4)**: Gli ordini entrano in coda da Selly ERP (API o CSV), Web Shop `norsan.it` o Amazon FBM. Il Team Lead può stampare in blocco le distinte A4 con barcode Code 128-B.
3. **Scansione Poka-Yoke o Conferma da Bolla**:
   - Scansionando il barcode sulla distinta A4, il WMS apre istantaneamente l'ordine corrispondente e illumina i LED sugli scaffali.
   - L'operatore può scansionare i singoli flaconi (con verifica anti-errore e anti-overpack) oppure premere **Conferma Prelievo da Bolla** se ha già verificato i pezzi fisicamente.
   - Se un flacone ha un EAN di un nuovo lotto non riconosciuto, l'operatore può associarlo in 1 clic al prodotto corretto (`BarcodeBindModal`).
4. **Validazione Obbligatoria Allegati**: Prima di abilitare il pulsante **STAMPA ETICHETTA**, il sistema verifica che siano confermati eventuali volantini, omaggi fedeltà (`retentionGift`) e documenti cartacei B2B (`requiresPhysicalDocument`).
5. **Etichetta Termica Multi-Collo & Chiusura**: L'operatore seleziona il numero di colli, stampa l'etichetta termica DHL Express A6 con barcode Code 128-B reale e passa automaticamente all'ordine successivo in coda.
