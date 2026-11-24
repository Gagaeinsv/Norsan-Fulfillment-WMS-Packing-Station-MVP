# Guida al Backend NORSAN WMS: Architettura, Composizione e Deploy

Questo documento descrive la parte server (`server/`) del sistema **NORSAN & ZREEN Fulfillment WMS (Hub Bolzano)**: quali moduli e tabelle database la compongono, quali endpoint REST espone e come effettuare il deploy nella rete locale di magazzino oppure in cloud.

---

## 1. Da cosa è composto il Backend

La componente server è sviluppata in **TypeScript** su **Node.js 20+**, **Express 5** e database integrato **SQLite (`better-sqlite3`)**, che non richiede l'installazione separata di un server database esterno (tutti i dati risiedono nel file `server/data/wms.sqlite`).

```text
[Postazioni Imballaggio ST-01 / ST-02 / ST-03 + Dashboard Team Lead]
                       │  REST JSON (HTTP :3001)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                 server/index.ts (Express 5)              │
│  • CRUD coda ordini, slot 5S, operatori                  │
│  • Order Locking atomico (TTL 15 min) + Force Release    │
│  • Audit scansioni (opzionale), anomalie Kanban, binding │
└───────┬───────────────────────┬──────────────────────────┘
        │                       │
        ▼                       ▼
 server/db.ts          Servizi di integrazione (server/services/)
 (SQLite: 14 tabelle)   ├── carrierService.ts   (Mock / DHL API adapter)
  wms.sqlite            ├── sellySyncService.ts (Daemon sync Selly ERP)
                        └── p2lService.ts       (Driver HTTP ESP32 Pick-to-Light)
```

### File principali della cartella `server/`
| File | Responsabilità |
| :--- | :--- |
| [server/index.ts](../server/index.ts) | Server HTTP Express (`PORT=3001`), tutti gli endpoint REST API, transazioni di blocco ordini, coda `api_outbox` e gestore centralizzato degli errori JSON (`400` senza leak di stack trace). |
| [server/db.ts](../server/db.ts) | Inizializzazione SQLite (`server/data/wms.sqlite`, in modalità `NODE_ENV=test` usa `:memory:`), creazione delle 14 tabelle, migrazioni idempotenti per colonna su `orders` e seed iniziale (operatori, slot, scatole, volantini, catalogo). |
| [server/services/carrierService.ts](../server/services/carrierService.ts) | Interfaccia `CarrierProvider` con selettore `CARRIER_MODE=mock\|sandbox\|live`: `MockDhlCarrierProvider` (generazione tracking idempotenti `JJD...`) e predisposizione `DhlBusinessApiProvider` basata su `.env`. Espone inoltre `getIntegrationsReadiness()` (`dhl`, `selly`, `amazon`). |
| [server/services/sellySyncService.ts](../server/services/sellySyncService.ts) | Daemon con polling periodico verso la REST API di Selly ERP (attivo in presenza di `SELLY_API_KEY` e `SELLY_AUTO_SYNC=true`), con parsing indirizzi e mapping catalogo. |
| [server/services/p2lService.ts](../server/services/p2lService.ts) | Client HTTP per il controller **ESP32 Pick-to-Light** su rete locale (`ESP32_IP:ESP32_PORT`) con deduplicazione delle richieste e fallback automatico in mock se il dispositivo è offline. |
| [server/tests/](../server/tests/) | 6 suite automatiche attive (`29` test su Vitest + Supertest) più la suite `domainServicesAndAuditFixes.test.ts` per i moduli congelati di Fase 2–3. |

---

## 2. Database SQLite (`server/data/wms.sqlite`)

Il file del database viene creato automaticamente al primo avvio (`server/db.ts`). Lo schema attuale comprende **14 tabelle**:

| Gruppo | Tabella | Dati memorizzati |
| :--- | :--- | :--- |
| **Catalogo & 5S** | `products` | Anagrafica SKU/EAN, brand (`NORSAN`/`ZREEN`), peso, fragilità, istruzioni. |
| | `warehouse_slots` | Topologia delle celle scaffale (`slot_code`, lato `S`/`D`, livello `tier`). |
| | `product_slotting` | Assegnazione corrente di ciascun SKU a una cella di scaffale. |
| | `boxes`, `marketing_flyers` | Catalogo dei 9 formati scatola e degli inserti promozionali. |
| **Staff & Ruoli** | `operators` | Operatori e Team Lead (`operator_code`, `pin`, ruolo, turno, `packed_today`, `is_active`). |
| **Imballaggio & Lock** | `orders` | Ordini + campi per operatività multi-banco: `locked_by_operator_id`, `locked_by_operator_name`, `locked_by_station_id`, `locked_at`, `assigned_station_id`, `address_details_json`, `address_status`, `packing_started_at`, `packing_completed_at`, `marketing_flyers_json`, `gift_confirmed`, `physical_doc_confirmed`, `package_count`. |
| | `order_items` | Righe prodotto di ogni ordine (`quantity_required`, `quantity_scanned`, `status`). |
| **Operatività Condivisa** | `issues` | Richieste Kanban e segnalazioni anomalie dai banchi (`status`: `pending`/`resolved`, `resolved_by`, `resolved_at`). |
| | `barcode_bindings` | Associazioni personalizzate di codici a barre non censiti (`raw_barcode` → `target_sku`), condivise tra tutte le postazioni. |
| | `scan_audit_logs` | Storico delle scansioni opzionali e degli avvisi registrati ai banchi. |
| **Coda API** | `api_outbox` | Coda ordini imballati (`status = 'pending_api'`) con numero tracking e quantità colli pronta per l'invio a Selly ERP / Amazon SP-API. |
| **Fase 2–3 (Congelate)** | `inventory_stock`, `product_lots` | Tabelle predisposte per stock su 2 livelli e tracciabilità lotti FEFO (disattivate in `src/config/wmsPhaseConfig.ts`). |

---

## 3. Riferimento REST API

### Prodotti & Slotting 5S
- `GET /api/products` — elenco completo prodotti con coordinate scaffale assegnate.
- `GET /api/slots` — tutte le celle scaffale con eventuali SKU collegati.
- `POST /api/slotting/assign` — assegna o libera una cella (`{ slotCode, productId }`).
- `POST /api/slots/add` | `DELETE /api/slots/:slotCode` — aggiunta (livello `1..5`) o eliminazione slot.

### Operatori & Autenticazione
- `GET /api/operators` — elenco operatori e Team Lead attivi.
- `POST /api/operators/verify` — verifica badge e/o PIN (`{ code, pin }`).
- `POST /api/operators` | `PUT /api/operators/:id` | `DELETE /api/operators/:id` — gestione anagrafica staff.

### Coda Ordini, Order Locking, Checklist & Indirizzi
- `GET /api/orders` — tutti gli ordini con righe articoli, volantini, `addressDetails` e stato lock attivo (i blocchi più vecchi di 15 minuti vengono restituiti automaticamente come `null`).
- `POST /api/orders/bulk` — caricamento massivo ordini da CSV/ERP (`{ orders, replace }`).
- `POST /api/orders/:id/lock` — **blocco atomico ordine** per `{ operatorId, operatorName, stationId }`. Se già bloccato da un altro operatore (< 15 min), restituisce **`409 Conflict`**. Sblocca automaticamente eventuali altri ordini aperti dello stesso operatore.
- `POST /api/orders/:id/unlock` — rilascio blocco (`{ operatorId, force }`). Senza `force: true` un altro operatore riceve `403`. Il Team Lead può forzare lo sblocco con `force: true`.
- `PATCH /api/orders/:id/status` — aggiornamento stato (`packing`, `packed`, `shipped`). Al passaggio a `packed`/`shipped` rilascia il lock e inserisce la voce in `api_outbox`.
- `PATCH /api/orders/:id/checklist` — salva su DB le conferme di volantini, omaggio fedeltà e documenti cartacei B2B.
- `PATCH /api/orders/:id/address` — salva su DB l'indirizzo normalizzato/corretto.
- `PATCH /api/orders/:id/item` | `PATCH /api/orders/:id/box` | `PATCH /api/orders/:id/package-count` | `DELETE /api/orders/:id` | `POST /api/orders/clear-packed` — aggiornamento quantità, scatola, multi-collo e pulizia coda.

### Kanban, Associazioni Condivise, Audit & Integrazioni
- `GET /api/issues` | `POST /api/issues` | `PATCH /api/issues/:id/resolve` — coda persistente delle segnalazioni tra banchi e Team Lead.
- `GET /api/barcode-bindings` | `POST /api/barcode-bindings` — associazioni barcode personalizzate condivise su tutte le postazioni.
- `POST /api/audit/scan` | `GET /api/audit/summary` — registrazione scansioni e riepilogo aggregato (`totalScans`, `blockedErrors`, `topErrors`, ultimi 20 record).
- `GET /api/integrations/status` — stato configurazione credenziali `dhl`, `selly`, `amazon` e contatore `outboxPendingCount`.

### Pick-to-Light (ESP32), Selly Daemon & Health
- `GET /api/p2l/status` | `POST /api/p2l/light` | `POST /api/p2l/scanned` | `POST /api/p2l/error` | `POST /api/p2l/clear`
- `GET /api/selly/config` | `POST /api/selly/config` | `POST /api/selly/sync-now`
- `GET /api/health` — endpoint di controllo stato servizio (`{ status: "ok", timestamp }`).

---

## 4. Configurazione tramite Variabili d'Ambiente (`.env`)

Il template ufficiale si trova in [.env.example](../.env.example).

| Variabile | Default | Descrizione |
| :--- | :--- | :--- |
| `PORT` | `3001` | Porta HTTP del server Express. |
| `NODE_ENV` | `production` | `production` usa `wms.sqlite`; `test` usa database in memoria `:memory:`. |
| `CARRIER_MODE` | `mock` | Modalità adapter corriere (`mock` \| `sandbox` \| `live`). |
| `DHL_API_KEY` | — | Chiave DHL Business API / aggregatore (porta lo stato in `/api/integrations/status` su `ready`). |
| `DHL_ACCOUNT_NUMBER` | — | Numero conto/contratto DHL. |
| `SELLY_API_URL` | `https://api.sellyerp.com/v1` | URL base della REST API di Selly ERP. |
| `SELLY_API_KEY` | — | Token Bearer per importazione diretta da Selly ERP. |
| `SELLY_SYNC_INTERVAL_MIN` | `5` | Intervallo di polling automatico (minuti). |
| `SELLY_AUTO_SYNC` | `false` | Abilita il daemon automatico `sellySyncService` (`true`/`false`). |
| `AMAZON_SP_REFRESH_TOKEN` | — | Refresh token per futura sincronizzazione Amazon SP-API. |
| `ESP32_IP` / `ESP32_PORT` / `P2L_TIMEOUT_MS` | `192.168.1.200` / `80` / `800` | Parametri di rete per il controller hardware Pick-to-Light. |
| `VITE_API_BASE` | `http://<host>:3001/api` | **Variabile build frontend**: se il frontend gira su un dominio/host diverso dal backend, impostare l'URL completo dell'API. |

---

## 5. Come effettuare il Deploy del Backend (3 Scenari)

### Opzione A (Consigliata per Hub Bolzano LAN): Docker Compose
Il repository include [Dockerfile](../Dockerfile) (Node 20 Alpine + compilazione `better-sqlite3`) e [docker-compose.yml](../docker-compose.yml) con volume persistente `./server/data:/app/server/data`, così il file `wms.sqlite` non si perde al riavvio del container.

1. Copia il template e compila eventuali credenziali API:
   ```bash
   cp .env.example .env
   ```
2. Avvia il container in background:
   ```bash
   docker compose up -d --build
   ```
3. Quando aggiungi le chiavi API in `.env`, verifica che `env_file: .env` sia attivo in `docker-compose.yml` e riavvia:
   ```bash
   docker compose up -d --build
   docker compose logs -f wms-backend
   ```

### Opzione B: Esecuzione diretta su PC Windows di Magazzino (Node.js 20+)
Adatto se un PC fisso a Bolzano funge da server locale per `ST-01` e `ST-02`.

1. Installa **Node.js 20 LTS** sul PC host.
2. Installa le dipendenze e avvia il server:
   ```powershell
   npm install
   npx tsx server/index.ts
   ```
   *(Per l'esecuzione continua in background è consigliabile `pm2 start npx --name wms-backend -- tsx server/index.ts` oppure un'attività pianificata Windows all'avvio del sistema.)*
3. Apri la porta TCP **`3001`** in ingresso sulla rete aziendale (Windows Defender Firewall).
4. Dai banchi secondari (`ST-02`, postazione Team Lead), collegati al frontend configurato con l'IP locale del server (`VITE_API_BASE=http://<IP_LOCALE_SERVER>:3001/api`) servito sulla stessa rete locale (`http://` — vedere la nota Mixed Content nella sezione Risoluzione Problemi).

### Opzione C: Backend su VPS / Cloud (Railway, Render, VPS Linux) + Frontend su Vercel
Scelta ottimale se gli operatori aprono l'app dall'URL **HTTPS su Vercel** (`vercel.json`):

1. Esegui il deploy del container da [Dockerfile](../Dockerfile) su una VPS o PaaS con **Persistent Disk / Volume** montato su `/app/server/data` (fondamentale affinché `wms.sqlite` sopravviva ai redeploy).
2. Esponi la porta `3001` tramite reverse proxy HTTPS (Caddy, Nginx o SSL del provider), ad esempio `https://api-wms.tuodominio.it`.
3. Imposta nelle variabili d'ambiente del progetto Vercel:
   ```text
   VITE_API_BASE=https://api-wms.tuodominio.it/api
   ```
   ed esegui un nuovo deploy del frontend (`Redeploy`).

---

## 6. Verifiche Post-Avvio, Test e Backup

### Controllo rapido di funzionamento
```bash
curl http://localhost:3001/api/health
# Risposta attesa: {"status":"ok","timestamp":...}

curl http://localhost:3001/api/integrations/status
# Mostra stato credenziali DHL / Selly / Amazon e ordini in api_outbox
```

### Esecuzione suite di test (29 test attivi)
```bash
npx vitest run server/tests/api.test.ts server/tests/hardening.test.ts server/tests/p2l.test.ts server/tests/sellyCsvImporter.test.ts server/tests/catalogIntegrity.test.ts server/tests/productionReadiness.test.ts
```

### Backup giornaliero SQLite
A fine turno è sufficiente copiare il file `server/data/wms.sqlite` (o dall'esterno del container Docker la cartella `./server/data/wms.sqlite`) in una directory di backup datata (`wms-YYYY-MM-DD.sqlite`).

---

## 7. Risoluzione Problemi Comuni (Troubleshooting)

- **Vercel (HTTPS) non raggiunge il server su IP locale (`http://192.168.x.x:3001`)**: i browser moderni bloccano il *Mixed Content* (richieste HTTP verso rete locale da pagine HTTPS). **Soluzione:** servire il frontend compilato in locale via HTTP nella rete di magazzino (`npm run build` + Nginx/Caddy) oppure pubblicare il backend sotto HTTPS (Opzione C / Cloudflare Tunnel / Tailscale HTTPS).
- **Errore compilazione `better-sqlite3` su Windows**: utilizzare **Node.js 20 LTS** (con binari precompilati) oppure avviare il servizio tramite **Docker Compose** (Opzione A).
- **I dati vengono persi al riavvio di Docker**: verificare che il volume `./server/data:/app/server/data` sia montato correttamente in [docker-compose.yml](../docker-compose.yml).
- **Porta `3001` occupata**: impostare un'altra porta in `.env` (`PORT=3005`) e aggiornare di conseguenza `VITE_API_BASE`.
