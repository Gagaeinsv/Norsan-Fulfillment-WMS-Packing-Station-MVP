# Інструкція по бекенду NORSAN WMS: архітектура, склад і розгортання

Цей документ описує серверну частину (`server/`) системи **NORSAN & ZREEN Fulfillment WMS (Hub Bolzano)**: з яких модулів та таблиць БД вона складається, які API надає, і як розгорнути її у локальній мережі складу чи в хмарі.

---

## 1. З чого складається бекенд

Серверна частина написана на **TypeScript** поверх **Node.js 20+**, **Express 5** та вбудованої бази даних **SQLite (`better-sqlite3`)**, яка не вимагає окремо встановленого сервера баз даних (усі дані лежать в одному файлі `server/data/wms.sqlite`).

```text
[Пакувальні столи ST-01 / ST-02 / ST-03 + Кабінет Team Lead]
                       │  REST JSON (HTTP :3001)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                 server/index.ts (Express 5)              │
│  • CRUD черги замовлень, слотів 5S, операторів           │
│  • Атомарний Order Locking (TTL 15 хв) + Force Release   │
│  • Аудит сканів (Poka-Yoke), Kanban-аномалії, біндинги   │
└───────┬───────────────────────┬──────────────────────────┘
        │                       │
        ▼                       ▼
 server/db.ts          Сервіси інтеграцій (server/services/)
 (SQLite: 14 таблиць)   ├── carrierService.ts   (Mock / DHL API adapter)
  wms.sqlite            ├── sellySyncService.ts (Daemon синку з Selly ERP)
                        └── p2lService.ts       (HTTP-драйвер ESP32 Pick-to-Light)
```

### Ключові файли каталогу `server/`
| Файл | Призначення |
| :--- | :--- |
| [server/index.ts](../server/index.ts) | Основний HTTP-сервер Express (`PORT=3001`), усі маршрути REST API, транзакції блокування замовлень, черга outbox і захищений JSON error handler (`400` без витоку stack trace). |
| [server/db.ts](../server/db.ts) | Ініціалізація SQLite (`server/data/wms.sqlite`, у режимі `NODE_ENV=test` — `:memory:`), створення 14 таблиць, безпечні порозділові міграції колонок `orders` і початковий seed (оператори, слоти, коробки, флаєри, товари). |
| [server/services/carrierService.ts](../server/services/carrierService.ts) | Інтерфейс `CarrierProvider` із перемикачем `CARRIER_MODE=mock|sandbox|live`: `MockDhlCarrierProvider` (генерація ідемпотентних трекінгів `JJD...`) та каркас `DhlBusinessApiProvider` під ключі з `.env`. Також збирає зведення готовності `getIntegrationsReadiness()` (`dhl`, `selly`, `amazon`). |
| [server/services/sellySyncService.ts](../server/services/sellySyncService.ts) | Фоновий таймер опитування Selly ERP REST API (вмикається при наявності `SELLY_API_KEY` та `SELLY_AUTO_SYNC=true`), автоматично розбирає адреси і мапить товари. |
| [server/services/p2lService.ts](../server/services/p2lService.ts) | Клієнт до контролера **ESP32 Pick-to-Light** по локальній мережі (`ESP32_IP:ESP32_PORT`) з дедуплікацією запитів і автоматичним mock-режимом, якщо залізо офлайн. |
| [server/tests/](../server/tests/) | 6 активних наборів автотестів (`29` тестів на Vitest + Supertest) + окремий набір `domainServicesAndAuditFixes.test.ts` для заморожених модулів Фази 2–3. |

---

## 2. База даних SQLite (`server/data/wms.sqlite`)

Файл БД створюється автоматично при першому старті (`server/db.ts`). На поточному етапі в схемі **14 таблиць**:

| Група | Таблиця | Що зберігає |
| :--- | :--- | :--- |
| **Каталог і 5S** | `products` | Довідник SKU/EAN, бренд (`NORSAN`/`ZREEN`), вага, крихкість, інструкції. |
| | `warehouse_slots` | Топологія комірок стелажів (`slot_code`, сторона `S`/`D`, ярус `tier`). |
| | `product_slotting` | Поточна прив’язка кожного SKU до комірки стелажа. |
| | `boxes`, `marketing_flyers` | Довідник 9 типів коробок та рекламних вкладень. |
| **Штати і ролі** | `operators` | Оператори й Team Lead (`operator_code`, `pin`, роль, зміна, `packed_today`, `is_active`). |
| **Пакування і лок** | `orders` | Замовлення + поля для multi-столів: `locked_by_operator_id`, `locked_by_operator_name`, `locked_by_station_id`, `locked_at`, `assigned_station_id`, `address_details_json`, `address_status`, `packing_started_at`, `packing_completed_at`, `marketing_flyers_json`, `gift_confirmed`, `physical_doc_confirmed`, `package_count`. |
| | `order_items` | Товарні рядки кожного замовлення (`quantity_required`, `quantity_scanned`, `status`). |
| **Міжстанційна робота** | `issues` | Сигнали зі столів на поповнення Kanban / брак (`status`: `pending`/`resolved`, `resolved_by`, `resolved_at`). |
| | `barcode_bindings` | Прив’язки нестандартних/нових штрих-кодів (`raw_barcode` → `target_sku`), спільні для всіх столів. |
| | `scan_audit_logs` | Історія всіх сканів (успішних та заблокованих помилок Poka-Yoke). |
| **API-інтеграція** | `api_outbox` | Черга запакованих замовлень (`status = 'pending_api'`) з трекінгом та кількістю місць для зворотного запису в Selly ERP / Amazon SP-API. |
| **Фаза 2–3 (Заморожено)** | `inventory_stock`, `product_lots` | Заготовки для палетно-поличного обліку й партій FEFO (вимкнені у `src/config/wmsPhaseConfig.ts`). |

---

## 3. Довідник REST API

### Товари та Slotting 5S
- `GET /api/products` — перелік товарів із поточними координатами на полицях.
- `GET /api/slots` — усі комірки стелажів із прив’язаними SKU.
- `POST /api/slotting/assign` — прив’язка/відв’язка товару до слоту (`{ slotCode, productId }`).
- `POST /api/slots/add` | `DELETE /api/slots/:slotCode` — створення (ярус `1..5`) або видалення комірки.

### Оператори та авторизація
- `GET /api/operators` — список активних операторів і Team Lead.
- `POST /api/operators/verify` — перевірка бейджа та/або PIN (`{ code, pin }`).
- `POST /api/operators` | `PUT /api/operators/:id` | `DELETE /api/operators/:id` — керування персоналом.

### Черга замовлень, Order Locking, чеклісти та адреси
- `GET /api/orders` — усі замовлення з товарами, флаєрами, розпарсеними `addressDetails` та активним lock-статусом (локи старіші 15 хв автоматично повертаються як `null`).
- `POST /api/orders/bulk` — масове завантаження замовлень із CSV/ERP (`{ orders, replace }`).
- `POST /api/orders/:id/lock` — **атомарне блокування замовлення** за `{ operatorId, operatorName, stationId }`. Якщо вже заблоковано іншим оператором (< 15 хв) — повертає **`409 Conflict`**. Автоматично знімає попередній lock цього ж оператора на іншому незакритому замовленні.
- `POST /api/orders/:id/unlock` — зняття блокування (`{ operatorId, force }`). Без `force: true` інший оператор отримує `403`. Team Lead знімає будь-який lock через `force: true`.
- `PATCH /api/orders/:id/status` — зміна статусу (`packing`, `packed`, `shipped`). При переході у `packed`/`shipped` автоматично очищає lock і додає запис у `api_outbox`.
- `PATCH /api/orders/:id/checklist` — збереження галочок флаєрів, подарунка і B2B-документів.
- `PATCH /api/orders/:id/address` — збереження виправленої/нормалізованої адреси доставки.
- `PATCH /api/orders/:id/item` | `PATCH /api/orders/:id/box` | `PATCH /api/orders/:id/package-count` | `DELETE /api/orders/:id` | `POST /api/orders/clear-packed` — оновлення позицій, коробки, мульти-колло та очищення черги.

### Kanban, спільні біндинги, аудит та інтеграції
- `GET /api/issues` | `POST /api/issues` | `PATCH /api/issues/:id/resolve` — черга аномалій і поповнень між столами та лідом.
- `GET /api/barcode-bindings` | `POST /api/barcode-bindings` — спільна таблиця нестандартних штрих-кодів для всіх столів.
- `POST /api/audit/scan` | `GET /api/audit/summary` — запис та зведення сканів (`totalScans`, `blockedErrors`, `topErrors`, останні 20 логів).
- `GET /api/integrations/status` — стан готовності ключів `dhl`, `selly`, `amazon` + кількість записів `outboxPendingCount`.

### Pick-to-Light (ESP32), Selly Daemon і Health
- `GET /api/p2l/status` | `POST /api/p2l/light` | `POST /api/p2l/scanned` | `POST /api/p2l/error` | `POST /api/p2l/clear`
- `GET /api/selly/config` | `POST /api/selly/config` | `POST /api/selly/sync-now`
- `GET /api/health` — перевірка працездатності (`{ status: "ok", timestamp }`).

---

## 4. Конфігурація через змінні середовища (`.env`)

Шаблон знаходиться в [.env.example](../.env.example).

| Змінна | За замовчуванням | Опис |
| :--- | :--- | :--- |
| `PORT` | `3001` | Порт HTTP-сервера Express. |
| `NODE_ENV` | `production` | `production` пише в `wms.sqlite`; `test` використовує БД у пам’яті `:memory:`. |
| `CARRIER_MODE` | `mock` | Режим адаптера перевізника (`mock` \| `sandbox` \| `live`). |
| `DHL_API_KEY` | — | Ключ DHL Business API / агрегатора (перемикає статус у `/api/integrations/status` на `ready`). |
| `DHL_ACCOUNT_NUMBER` | — | Номер контракту/рахунку DHL. |
| `SELLY_API_URL` | `https://api.sellyerp.com/v1` | Базовий URL Selly ERP API. |
| `SELLY_API_KEY` | — | Bearer-токен для прямого імпорту з Selly ERP. |
| `SELLY_SYNC_INTERVAL_MIN` | `5` | Інтервал автосинхронізації (хв). |
| `SELLY_AUTO_SYNC` | `false` | Автоматичний запуск таймера `sellySyncService` (`true`/`false`). |
| `AMAZON_SP_REFRESH_TOKEN` | — | Refresh token для майбутньої інтеграції Amazon SP-API. |
| `ESP32_IP` / `ESP32_PORT` / `P2L_TIMEOUT_MS` | `192.168.1.200` / `80` / `800` | Мережеві параметри контролера Pick-to-Light. |
| `VITE_API_BASE` | `http://<host>:3001/api` | **Змінна фронтенду при збірці**: якщо фронтенд відкривається не з того самого хоста, що й бекенд, вказується повна адреса API. |

---

## 5. Як розгорнути бекенд (3 сценарії)

### Варіант A (Рекомендований для хабу Bolzano): Docker Compose
У репозиторії вже є [Dockerfile](../Dockerfile) (Alpine Linux + збірка `better-sqlite3`) та [docker-compose.yml](../docker-compose.yml) з примонтованим томом `./server/data:/app/server/data`, щоб база `wms.sqlite` зберігалась при оновленні контейнера.

1. Скопіюй шаблон і пропиши змінні (коли з’являться API-ключі — додай у `.env`):
   ```bash
   cp .env.example .env
   ```
2. Збери й запусти у фоні:
   ```bash
   docker compose up -d --build
   ```
3. Якщо в `.env` додаються нові ключі API або змінено код, переконайся, що в `docker-compose.yml` підключено `env_file: .env`, і перезапусти:
   ```bash
   docker compose up -d --build
   docker compose logs -f wms-backend
   ```

### Варіант B: Напряму на Windows-ПК складу через Node.js 20+
Підходить, якщо один стаціонарний ПК у Болцано працює як локальний сервер для `ST-01` і `ST-02`.

1. Встанови **Node.js 20 LTS** (для збірки `better-sqlite3` за відсутності prebuild може знадобитись Windows Build Tools).
2. Встанови залежності та запусти бекенд:
   ```powershell
   npm install
   npx tsx server/index.ts
   ```
   *(Для фонової роботи без відкритого вікна зручно використовувати `pm2 start npx --name wms-backend -- tsx server/index.ts` або Windows Task Scheduler на автозапуск при старті ПК.)*
3. Відкрий вхідний TCP-порт **`3001`** у локальній мережі (Windows Defender Firewall).
4. На інших столах (`ST-02`, комп’ютер ліда) відкривай фронтенд, зібраний із `VITE_API_BASE=http://<ЛОКАЛЬНИЙ_IP_СЕРВЕРА>:3001/api`, або через локальний IP за умови, що фронтенд роздається також у локальній мережі (`http://`, не `https://` Vercel — див. розділ Troubleshooting).

### Варіант C: Хмарний VPS / PaaS (Railway, Render, Hetzner VPS) + Vercel Frontend
Рекомендовано, коли пакувальні столи відкривають фронтенд через **HTTPS на Vercel** (`vercel.json`):

1. Розгорни контейнер із [Dockerfile](../Dockerfile) на VPS або сервісі з підтримкою **Persistent Disk / Volume** (критично: змонтувати постійний диск на `/app/server/data`, інакше `wms.sqlite` зітреться при редеплої).
2. Проксіюй порт `3001` через HTTPS (Caddy, Nginx або вбудований SSL провайдера), наприклад `https://api-wms.your-domain.it`.
3. Вкажи в налаштуваннях проєкту Vercel змінну середовища:
   ```text
   VITE_API_BASE=https://api-wms.your-domain.it/api
   ```
   і перезбери фронтенд (`Redeploy`).

---

## 6. Перевірка після запуску, тести та бекапи

### Швидка перевірка здоров’я сервера
```bash
curl http://localhost:3001/api/health
# Очікується: {"status":"ok","timestamp":...}

curl http://localhost:3001/api/integrations/status
# Покаже готовність DHL / Selly / Amazon і кількість замовлень у api_outbox
```

### Прогін автотестів (29 активних тестів)
```bash
npx vitest run server/tests/api.test.ts server/tests/hardening.test.ts server/tests/p2l.test.ts server/tests/sellyCsvImporter.test.ts server/tests/catalogIntegrity.test.ts server/tests/productionReadiness.test.ts
```

### Щоденний бекап бази SQLite
Перед закриттям зміни достатньо скопіювати файл `server/data/wms.sqlite` (або в Docker — з примонтованої папки `./server/data/wms.sqlite`) у папку резервних копій з датою, наприклад `wms-YYYY-MM-DD.sqlite`.

---

## 7. Типові проблеми (Troubleshooting)

- **Vercel (HTTPS) не стукається в локальний IP (`http://192.168.x.x:3001`)**: сучасні браузери блокують Mixed Content (запити з `https://` сайту на `http://` локальний IP). **Рішення:** або роздавати зібраний фронтенд локально по `http://` у мережі складу (`npm run build` + Nginx/Caddy/serve), або підняти бекенд під HTTPS (Варіант C / Tailscale / Cloudflare Tunnel).
- **Помилка компіляції `better-sqlite3` на Windows**: використовуйте **Node.js 20 LTS** (має готові бінарні пребілди) або запускайте через **Docker Compose** (Варіант A).
- **Зміни в БД не зберігаються між перезапусками Docker**: перевірте наявність volume `./server/data:/app/server/data` у [docker-compose.yml](../docker-compose.yml).
- **Порт `3001` уже зайнятий**: задайте інший порт у `.env` (`PORT=3005`) та оновіть `VITE_API_BASE`.
