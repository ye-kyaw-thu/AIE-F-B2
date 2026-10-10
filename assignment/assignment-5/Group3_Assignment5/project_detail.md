# Project Specification: Myanmar Real-Time Logistics & Tracking System (RLTS-MM)
**Rapid Prototype for Cross-Border Supply Chain Monitoring Under Volatile & Intermittent Connectivity**

---

## 1. Executive Summary & Problem Context

Cross-border and domestic cargo movement in Myanmar operates under extreme logistical volatility. Freight moving along key trade arteries—such as the **Northern Corridor (Yangon – Mandalay – Pyin Oo Lwin – Lashio – Muse / China Border)** and the **Eastern Corridor (Yangon – Bago – Hpa-An – Kawkareik – Myawaddy / Thailand Border)**—encounters severe operational hurdles:

1. **Unpredictable Border & Route Disruptions:** Border gates and mountain bypasses close abruptly due to policy shifts, customs disputes, infrastructure failure, or regional instability.
2. **Prolonged Checkpoint Inspections:** Military, customs, and regional checkpoints require physical document checks, cause unannounced bottlenecks, and demand constant status updates.
3. **Pervasive Network Blackouts & Dead Zones:** Telecommunications infrastructure is frequently severed or throttled. Mountainous terrain (Shan Hills, Dawna Range) creates extended zero-signal dead zones where drivers cannot access 3G/4G/5G mobile internet.
4. **Information Asymmetry:** Traders have zero visibility once cargo leaves the depot; drivers are overwhelmed trying to call dispatchers; logistics managers cannot reroute fleets dynamically.

This project delivers a **resilient, offline-first tracking prototype** that marries the rugged architectural principles of field-proven eLMIS/SCM platforms (**Logistimo**, **OpenLMIS**, and **Open mSupply**) with rapid modern web and mobile technologies.

---

## 2. Core Architectural Philosophy: Offline-First & Resilient

Most commercial telematics platforms assume continuous high-speed cellular connectivity and fail catastrophically when disconnected. Following the design patterns of **Logistimo** (rural vaccine SCM) and **Open mSupply** (remote health logistics), our system treats **offline operation not as an exception, but as a normal operating state**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SYSTEM TOPOLOGY & DATA FLOW                        │
└─────────────────────────────────────────────────────────────────────────────┘

       [ ADMIN DISPATCH CONSOLE ]                 [ TRADER TRACKING PORTAL ]
        - Gate Disruption Control                  - Live Milestone Timeline
        - Global Fleet Map Overview                - Instant Emergency Alerts
        - Broadcast Communications                 - Proof of Delivery Viewer
                    │                                          │
                    │ (WebSocket / Postgres CDC)               │ (WebSocket)
                    ▼                                          ▼
       ┌──────────────────────────────────────────────────────────────┐
       │             CLOUD BACKEND (BaaS / API LAYER)                 │
       │    - Supabase (PostgreSQL + PostGIS + Realtime Channels)     │
       │    - Cloud Storage (Document Photos / Inspection Proofs)     │
       │    - Event Ingestion & Audit Log Engine                      │
       └──────────────────────────────▲───────────────────────────────┘
                                      │
                         (Bidirectional Delta Sync
                          When Connection Restored)
                                      │
       ┌──────────────────────────────┴───────────────────────────────┐
       │                DRIVER MOBILE CLIENT (PWA)                    │
       │                                                              │
       │  ┌────────────────────────────────────────────────────────┐  │
       │  │               DRIVER USER INTERFACE                    │  │
       │  │   Big Touch Targets • Low-Bandwidth Mode • Alerts      │  │
       │  └───────────────────────────▲────────────────────────────┘  │
       │                              │                               │
       │  ┌───────────────────────────▼────────────────────────────┐  │
       │  │                  OFFLINE CLIENT ENGINE                 │  │
       │  │  - Network State Detector (Online / 2G / Blackout)     │  │
       │  │  - Transaction Queue (Store-and-Forward FIFO Engine)   │  │
       │  │  - Local Database: IndexedDB (Dexie.js)                │  │
       │  │  - GPS Telemetry Breadcrumb Collector                  │  │
       │  │  - Compressed Offline Image Store (Waybills/Receipts)  │  │
       │  └────────────────────────────────────────────────────────┘  │
       └──────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Dive: Myanmar-Specific Offline Capabilities Architecture

### 3.1. Local Client Storage Strategy (IndexedDB via Dexie.js)
The Driver Mobile Client operates independently of cloud connectivity by utilizing the browser's persistent **IndexedDB**:
* **Active Shipment Cache:** Stores full details of the assigned cargo, expected route waypoints, gate statuses, and emergency contacts.
* **Local Transaction Queue (`pending_sync_queue`):** All driver actions (checkpoint check-ins, time stamps, geolocations, uploaded inspection documents, delays) are written locally first with a state of `status: 'QUEUED_LOCALLY'`.
* **Idempotent Unique Identifiers:** Every event is assigned a client-side UUID (`event_uuid`) and high-resolution device timestamp (`client_recorded_at`). This prevents duplicate entries when retrying sync over unstable 2G links.

### 3.2. Store-and-Forward Synchronization Lifecycle
When a driver is traveling through a connectivity blackout:

```
[Driver Action at Checkpoint] 
      │
      ▼
1. Write to Local IndexedDB (Instant UI feedback, zero latency)
      │
      ▼
2. Network State Monitor polls connectivity (Heartbeat Ping + navigator.onLine)
      │
      ├────────────────────────────┐
      ▼ [Offline / Blackout]       ▼ [Connection Detected]
   Remain in Local Buffer       3. Initiate Batch Delta Sync
   Display "Offline (N queued)"    - Send batch payload to /api/sync
                                   - Server validates & stores in PostgreSQL
                                   - Server returns HTTP 200 with ACK IDs
                                   │
                                   ▼
                                4. Mark Local Records as 'SYNCED'
                                5. Pull latest Gate Alerts & Route Status
```

### 3.3. Conflict Resolution & Event Sourcing (Append-Only)
* **Logistimo & OpenLMIS Lesson:** Never allow server data to silently overwrite field operational logs.
* **Design Rule:** The telemetry and checkpoint logs use an **Append-Only Event Sourcing** model. Drivers own their event logs (what happened, when, where). The server never overwrites a driver's timestamp with the server's sync timestamp; it preserves both:
  * `client_recorded_at`: The actual time the driver reached the checkpoint (even in a blackout).
  * `server_synced_at`: The time the data reached the cloud.
* This ensures that when the truck emerges from a 6-hour mountain blackout, the trader's timeline displays the **chronologically correct journey progression**, not a false spike of events at the moment of reconnection.

### 3.4. Offline Image & Document Compression
* Checkpoint inspections require waybill, tax, and cargo photos.
* When offline, photos captured via the driver's device camera are compressed client-side (using HTML5 Canvas to `< 200 KB`, WebP format) and saved as Base64/Blobs in IndexedDB.
* When cellular network resumes, images are uploaded asynchronously to Cloud Storage (Supabase Storage / S3) without blocking core telemetry data.

### 3.5. Fallback Channels (SMS / USSD Simulation for Extreme Blackouts)
* Following **Logistimo's** hybrid SMS fallback: If data packets (HTTP/WebSocket) fail for more than 30 minutes, the mobile app generates a 1-click **Structured SMS payload** ready to send to an automated gateway number:
  ```text
  MM-TRK#SH8842#CKPT-KYAUKME#OK#LAT22.52#LNG97.03#T1430
  ```
* This allows drivers with only basic 2G voice/SMS GSM signal to update dispatch without high-speed data.

---

## 4. Role-Based Access Control (RBAC) & View Specifications

```
                     ┌───────────────────────────┐
                     │    UNIFIED AUTH ENGINE    │
                     └─────────────┬─────────────┘
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
  [ ADMIN CONSOLE ]        [ TRADER PORTAL ]       [ DRIVER MOBILE PWA ]
  Role: logistics_admin    Role: cargo_trader      Role: truck_driver
```

### 4.1. Admin / Dispatcher Console (`/admin`)
* **Global Route & Gate Control Center:**
  * Interactive switchboard to toggle border gates:
    * **Muse Border Gate (China):** `[ OPEN | CONGESTED | CLOSED | ARMED_INSPECTION ]`
    * **Myawaddy Border Gate (Thailand):** `[ OPEN | CONGESTED | CLOSED | FLOODING ]`
    * **Chinshwehaw Gate (China):** `[ OPEN | CLOSED ]`
  * Instant alert broadcast modal: Send custom alerts (e.g., *"Lashio bypass blocked. Rerouting via alternative mountain pass required"*) to all affected traders and drivers.
* **Fleet Live Map:** PostGIS/Leaflet map displaying all active trucks, route compliance, and delay flags.
* **Shipment Manifest Dispatch:** Create new shipments, assign drivers, define cargo manifest, and set planned routes.

### 4.2. Trader Portal (`/trader`)
* **Shipment Tracking Search:** Enter tracking number (e.g., `MM-2026-8842`) or view authenticated shipment portfolio.
* **Visual Milestone Progression Bar:**
  $$\text{Booked} \longrightarrow \text{Depot Pickup} \longrightarrow \text{In Transit} \longrightarrow \text{Checkpoint Clearance} \longrightarrow \text{Border Customs} \longrightarrow \text{Delivered}$$
* **Live Interactive Map:** Shows current truck position, traveled breadcrumbs, remaining corridor, and hazardous border gates.
* **Real-Time Notification Banner:** Instant reactive alert (red banner with audio chime) whenever a gate along their active route is toggled to `CLOSED`.
* **Document & Inspection Viewer:** View timestamped photos of inspection seals, gate passes, and signed waybills uploaded by the driver.

### 4.3. Driver Mobile Simulator (`/driver`)
* **Optimized Mobile Viewport:** Designed as a responsive smartphone UI (max-width 420px container for desktop demo).
* **Interactive Network Status Toggle (Demo Feature):**
  * Switch between: `[ 🟢 ONLINE 4G | 🟡 SLOW 2G | 🔴 OFFLINE BLACKOUT ]`.
* **Current Route Card:**
  * Origin $\rightarrow$ Destination, cargo description, contact numbers for emergency assistance.
  * Next Checkpoint alert (e.g., *"Next: Nawnghkio Inspection Point - 14 km"*).
* **One-Tap Checkpoint Actions:**
  * Big high-contrast buttons: `[ Arrived at Checkpoint ]`, `[ Inspection Passed ]`, `[ Report Delay / Danger ]`.
* **Offline Queue Badge:** Clear status counter: *"🟢 All data synced"* or *"🟡 3 updates cached locally (Syncing automatically)"*.
* **Photo Capture:** Quick camera input for waybill verification.

---

## 5. System Data Schema (PostgreSQL / Supabase Ready)

```sql
-- 1. BORDER GATES & STRATEGIC CHOKEPOINTS
CREATE TABLE border_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL, -- e.g., 'GATE_MUSE_105', 'GATE_MYAWADDY_FRIENDSHIP'
    name VARCHAR(100) NOT NULL,
    corridor VARCHAR(100) NOT NULL,   -- 'Northern (China)', 'Eastern (Thailand)'
    status VARCHAR(30) DEFAULT 'OPEN', -- 'OPEN', 'CONGESTED', 'CLOSED', 'EMERGENCY_HALT'
    closure_reason TEXT,
    coordinates_lat DOUBLE PRECISION NOT NULL,
    coordinates_lng DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. SHIPMENTS
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(50) UNIQUE NOT NULL, -- 'MM-TRK-8842'
    trader_id UUID REFERENCES auth.users(id),
    driver_id UUID REFERENCES auth.users(id),
    cargo_type VARCHAR(100) NOT NULL,          -- 'Agricultural Produce', 'Electronics'
    cargo_weight_tons NUMERIC(8,2),
    origin_name VARCHAR(100) NOT NULL,          -- 'Yangon Hlaing Tharyar Depot'
    destination_name VARCHAR(100) NOT NULL,     -- 'Muse 105-Mile Border Trade Zone'
    target_gate_id UUID REFERENCES border_gates(id),
    current_status VARCHAR(40) DEFAULT 'PICKED_UP',
    -- 'PICKED_UP', 'IN_TRANSIT', 'HELD_AT_CHECKPOINT', 'CUSTOMS_PROCESSING', 'DELIVERED', 'REROUTED'
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    is_delayed BOOLEAN DEFAULT FALSE,
    delay_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    estimated_arrival TIMESTAMPTZ
);

-- 3. CHECKPOINT & TELEMETRY AUDIT LOGS (OFFLINE-SYNC READY)
CREATE TABLE shipment_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_uuid UUID UNIQUE NOT NULL,            -- Generated on driver client for idempotency
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    checkpoint_name VARCHAR(100) NOT NULL,      -- e.g., 'Kyaukme Inspection Station'
    event_type VARCHAR(50) NOT NULL,            -- 'ARRIVED', 'CLEARED', 'DELAY_REPORTED', 'GPS_PING'
    notes TEXT,
    photo_url TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    client_recorded_at TIMESTAMPTZ NOT NULL,    -- Timestamp recorded locally on driver device
    server_synced_at TIMESTAMPTZ DEFAULT NOW()  -- Timestamp received by central server
);

-- 4. EMERGENCY ALERTS & BROADCASTS
CREATE TABLE emergency_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'CRITICAL',     -- 'INFO', 'WARNING', 'CRITICAL'
    gate_id UUID REFERENCES border_gates(id),
    route_affected VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Proposed Technical Implementation Structure

```
rlts-myanmar/
├── public/
│   ├── icons/                    # Logistics & offline status icons
│   ├── routes/                   # GeoJSON files for Myanmar Highway corridors
│   └── service-worker.js         # PWA Service Worker for offline asset caching
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Global state providers (Auth, Network, Alerts)
│   │   ├── page.tsx              # Landing page / Role selector portal
│   │   ├── admin/
│   │   │   ├── page.tsx          # Admin Command Center (Map + Gate Controls)
│   │   │   └── components/       # GateTogglePanel, FleetOverview, AlertDispatcher
│   │   ├── trader/
│   │   │   ├── page.tsx          # Trader Shipment Dashboard
│   │   │   └── components/       # MilestoneStepper, LiveMapTracker, DocumentViewer
│   │   └── driver/
│   │       ├── page.tsx          # Driver Mobile Simulator (PWA viewport)
│   │       └── components/       # OfflineStatusBar, CheckpointCheckin, CameraCapture
│   ├── components/               # Shared UI Components (Shadcn/Tailwind)
│   │   ├── MapContainer.tsx      # Leaflet map with truck markers & gate hazard pins
│   │   ├── NetworkSimulator.tsx  # Interactive Online/Offline testing toolbar
│   │   └── AlertBanner.tsx       # Real-time warning toast & alert ribbon
│   ├── lib/
│   │   ├── db/
│   │   │   ├── dexie-offline.ts  # Client-side IndexedDB database schema & queue
│   │   │   └── supabase.ts       # Supabase client & Realtime listeners
│   │   ├── sync/
│   │   │   └── sync-engine.ts    # Store-and-forward batch delta sync worker
│   │   └── geo/
│   │       └── myanmar-routes.ts # Hardcoded realistic waypoint sets for live demo
└── project_detail.md             # This comprehensive architecture document
```

---

## 7. Interactive Live Demo Script (15 Minutes)

To guarantee high marks on the demo evaluation, the group will showcase a synchronized 3-role live interaction:

```
[Screen Left: Admin Console]     [Screen Center: Driver Mobile View]     [Screen Right: Trader Dashboard]
```

* **Minute 00–03: Normal Transit Initiation**
  * Trader inspects shipment `MM-TRK-8842` (Yangon $\rightarrow$ Muse 105-Mile). Status shows `IN_TRANSIT` near Mandalay.
  * Driver screen shows green badge `● ONLINE`. GPS position advances along the highway.
* **Minute 03–07: Entering Network Blackout & Checkpoint Inspection**
  * Presenter clicks the **"Simulate Network: OFFLINE"** toggle on the Driver screen (simulating entering the Gokteik gorge / mountain dead zone).
  * Driver reaches *Kyaukme Military Checkpoint*: snaps an inspection seal photo, selects `"Arrived & Inspected"`, and submits.
  * **Key visual:** The Driver UI displays: `🟡 Saved Offline (1 pending sync)`. The app functions smoothly with zero lag or crash.
* **Minute 07–10: The Crisis (Admin Closes Border Gate)**
  * Admin receives intelligence that the **Muse Border Gate** has closed due to security conditions.
  * Admin toggles **Muse Gate Status $\rightarrow$ CLOSED**.
  * **Instant Reactive Event:** The Trader's dashboard flashes red with an emergency audio chime: *"CRITICAL ALERT: Destination Gate Muse Closed. Delays expected."*
* **Minute 10–13: Reconnection & Asynchronous Catch-Up**
  * Presenter clicks **"Simulate Network: ONLINE"** on the Driver screen.
  * The sync engine activates automatically: within seconds, the pending Kyaukme checkpoint record and photo are pushed to the cloud.
  * The Trader's timeline updates instantly, correctly placing the Kyaukme clearance at its true offline historical time, proving data integrity.
* **Minute 13–15: Dynamic Rerouting & Resolution**
  * Admin assigns an alternative destination (e.g., Mandalay Holding Depot). Driver acknowledges, Trader receives peace of mind.

---

## 8. 11-Member Team Execution & "Vibe Coding" Strategy

With 11 members, tight modular separation ensures zero friction:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         11-MEMBER TEAM ROLE ALLOCATION                      │
├──────────────────────┬────────────────────────┬─────────────────────────────┤
│ Stream               │ Count │ Focus          │ Primary AI Tools & Prompts  │
├──────────────────────┼───────┼────────────────┼─────────────────────────────┤
│ 1. Product Managers  │ 2     │ UX, Routes &   │ Cursor / Claude: Create     │
│                      │       │ Presentation   │ demo scripts & route data   │
├──────────────────────┼───────┼────────────────┼─────────────────────────────┤
│ 2. Frontend Coders   │ 3     │ 3 Distinct UIs │ v0.dev / Cursor: Generate   │
│                      │       │ (Admin/Trade/Dr│ Tailwind UI & Leaflet maps  │
├──────────────────────┼───────┼────────────────┼─────────────────────────────┤
│ 3. Backend Coders    │ 2     │ BaaS, Realtime │ Claude / ChatGPT: SQL, RLS, │
│                      │       │ & Offline Sync │ Dexie.js sync workers       │
├──────────────────────┼───────┼────────────────┼─────────────────────────────┤
│ 4. QA & Integrators  │ 2     │ End-to-End Bug │ Cursor / DevTools: Test     │
│                      │       │ Fixes & Sim    │ offline edge cases & sync   │
├──────────────────────┼───────┼────────────────┼─────────────────────────────┤
│ 5. Pitch Presenters  │ 2     │ 30-Min Deck &  │ Slide deck design, demo     │
│                      │       │ Reflection Doc │ choreography & timing       │
└──────────────────────┴───────┴────────────────┴─────────────────────────────┘
```

### High-Impact "Vibe Coding" Prompts for Team Kickoff:
* **For Frontend:**
  > *"Create a responsive Driver Mobile View using Next.js, Tailwind, and Lucide icons. It must include an interactive network toggle (Online, 2G, Offline Blackout). When offline, disable external network calls and write to Dexie.js IndexedDB. Include big touch-friendly buttons for checkpoint logging and photo capture."*
* **For Backend & Sync:**
  > *"Implement a store-and-forward sync engine in TypeScript using Dexie.js. When navigator.onLine becomes true or when manual sync is triggered, gather all pending records, send them in a batch POST request to /api/sync with idempotency keys, and update their local state to SYNCED upon HTTP 200."*
* **For Realtime Alerting:**
  > *"Set up a Supabase Realtime channel listening to updates on table 'border_gates'. When gate status changes to 'CLOSED', trigger an animated Red Alert modal with sound effects across all connected Trader dashboards."*

---
*Document prepared for the Myanmar Logistics & Tracking System Prototype (B2 Assignment 5).*
