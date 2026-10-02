# Architettura del Progetto - Norsan & ZREEN Fulfillment WMS (MVP)

Questo documento descrive la struttura completa della codebase, le dipendenze tra i moduli e il funzionamento interno dell'applicazione (WMS - Warehouse Management System).

## 📂 Struttura delle Directory

### `/src` (Frontend React)
Il cuore dell'applicazione React (Vite + TypeScript + Tailwind CSS). L'architettura è modulare e basata sul principio di Single Responsibility.

#### `src/components/` (Livello UI / Presentazione)
Tutti i componenti visivi, divisi per dominio di business:
*   **`/auth`**: Componenti per l'autenticazione (`OperatorAuthModal.tsx`, `TerminalLockScreen.tsx`, `SupervisorPinModal.tsx`). Gestisce il blocco dello schermo e i permessi.
*   **`/packing`**: Il cuore operativo (`ActivePackingView.tsx`, `PackingItemCard.tsx`, `PackingBanners.tsx`). Gestisce la visualizzazione dell'ordine attivo, lo stato di scansione e i feedback visivi (es. "Scatola completata").
*   **`/queue`**: Gestione della coda ordini (`OrderQueue.tsx`). Mostra gli ordini in attesa e il calcolo del Takt time.
*   **`/rack`**: Gestione visiva dello scaffale e Pick-to-Light (`StationRackGuide.tsx`, `RackSlotCell.tsx`, `RackSlotEditPanel.tsx`). Supporta la topologia reale a 5 livelli (A, B, C, D, E) dell'Hub di Bolzano e i tavoli speculari (Norsan/Zreen invertiti).
*   **`/supervisor`**: Pannello di controllo del Team Lead (`SupervisorDashboard.tsx` e la sottocartella `/tabs`). Permette la gestione dello Slotting (5S), KPI Lean, risoluzione anomalie e gestione operatori.
*   **`/layout`**: Componenti strutturali della pagina (`Header.tsx`, `ScannerStatusBanner.tsx`).
*   **`/dev`**: Strumenti di test e debug (`BarcodeSimulator.tsx`, `IssueReportModal.tsx`).
*   **`/shipping`**: Flusso di fine imballaggio (`ShippingLabelModal.tsx`), pronto per interfacciarsi con stampanti Zebra ZT411 tramite ZPL.

#### `src/hooks/` (Livello di Business Logic)
I Custom Hooks che gestiscono tutto lo stato dell'applicazione, isolando la logica dalla UI:
*   **`useWarehouseState.ts`**: Il "Cervello" (Global State Orchestrator) dell'app. Gestisce ordini, operatori, postazioni, KPI e gestisce le transizioni di stato. *Sostituisce soluzioni come Redux o Zustand per l'MVP.*
*   **`useBarcodeScanner.ts`**: Intercetta gli input fisici dello scanner hardware (es. lettori Zebra/Honeywell in modalità tastiera) a livello di finestra (window event listener).
*   **`useSoundEffects.ts`**: Genera feedback audio (Web Audio API) per successi, errori e completamento ordini.

#### `src/data/` (Livello Dati / Database Statico)
Dati mock e cataloghi di riferimento per il funzionamento standalone (senza backend):
*   **`norsanProducts.ts`** (e sottocartelle `/products`): Il database completo dei prodotti Norsan e Zreen, inclusi EAN, SKU e coordinate fisiche degli scaffali reali.
*   **`marketingFlyers.ts`**: Configurazione dei volantini marketing, gadget e tipologie di scatole logistische.
*   **`mockOrders.ts`**: Ordini e-commerce simulati (es. da SellyErp) per testare il flusso B2C/B2B.
*   **`mockOperators.ts`**: Database degli operatori (Packer, Team Lead, Supervisor).

#### `src/types/`
*   **`wms.ts`**: Contiene tutte le interfacce TypeScript (`Product`, `Order`, `Operator`, `WarehouseStation`, `StationKPIs`). È la "singola fonte di verità" per i tipi di dato.

#### `src/services/`
*   **`api.ts`**: Livello di astrazione per le chiamate API verso il backend. Per l'MVP, molte di queste funzioni simulano chiamate asincrone leggendo dai dati in `/data`.

#### File Radice (Frontend)
*   **`App.tsx`**: Orchestratore UI. Inizializza `useWarehouseState` e renderizza i macro-componenti (Header, Modal, Viste attive).
*   **`main.tsx`**: Entry point di React (creazione del DOM root).

### `/server` (Backend Node.js / Express - Se presente)
Astrazione per il database SQLite (Better-SQLite3) e le API REST. Gestisce lo slotting dinamico e l'ingestione reale degli ordini da ERP. (File principali: `index.ts`, `db.ts`).

---

## ⚙️ Come Funziona (Flusso Logico)

1. **Avvio e Autenticazione:** L'applicazione parte con la schermata bloccata (`TerminalLockScreen`). Un operatore scansiona il proprio badge. `useWarehouseState` verifica il permesso e sblocca la stazione.
2. **Ingestione Ordini (Paperless):** La lista degli ordini in `OrderQueue` viene popolata (da `mockOrders` o tramite chiamate API simulate in `api.ts`). L'operatore non stampa nulla su A4. L'ordine viene mostrato digitalmente.
3. **Scansione e Pick-to-Light (Poka-Yoke):** 
   - L'operatore scansiona un prodotto.
   - `useBarcodeScanner.ts` cattura l'EAN.
   - `useWarehouseState.ts` verifica se l'EAN appartiene all'ordine attivo (Poka-Yoke).
   - In caso di successo: aggiorna la UI, suona un feedback tramite `useSoundEffects.ts`. Se il prodotto è errato, registra un'anomalia e blocca l'operatore (suono di errore).
4. **Logica dei Tavoli Speculari:** I componenti leggono `stationConfigId` (`STATION_01` o `STATION_02`) per invertire visivamente la visualizzazione dello scaffale Norsan (destra/sinistra) su `StationRackGuide.tsx`.
5. **Completamento e Stampa:** Quando tutti gli item richiesti (`quantityRequired`) sono scansionati, si apre `ShippingLabelModal.tsx`. Questo simula la stampa di etichette ZPL su stampanti Zebra ZT411.
6. **Dashboard Supervisore:** Accessibile ai "Team Lead" scansionando il badge supervisore, ricarica `SupervisorDashboard.tsx` per metriche real-time e modifiche topologiche degli scaffali (Slotting).

---

## 🔗 Dipendenze Chiave (Ecosistema)

- **React 19 & TypeScript**: Core engine e tipizzazione forte per prevenire errori a runtime.
- **Vite**: Bundler ultra-veloce (sostituisce Webpack). Fondamentale per il deploy rapido su Vercel.
- **Tailwind CSS v4**: Styling modulare e utility-first (Zero CSS personalizzato, tutto via classi).
- **Lucide React**: Libreria di icone vettoriali leggere.
- **Web Audio API**: Per feedback sonori a bassa latenza senza necessità di file MP3 esterni (suoni generati tramite oscillatori).

## 🚀 Istruzioni per il Deploy su Vercel
Il progetto include un file `vercel.json` (se applicabile) o può essere deployato direttamente collegando questo branch `main` a Vercel con i seguenti settaggi standard (Zero-Config):
- **Framework Preset**: Vite
- **Build Command**: `npm run build` o `tsc && vite build`
- **Output Directory**: `dist`
