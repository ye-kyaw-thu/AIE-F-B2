# RLTS-MM — Real-Time Logistics Monitoring for Myanmar Trading

Rapid prototype for **B2 Assignment 5**. Implements the architecture in
[`../project_detail.md`](../project_detail.md) against the brief in [`../README.md`](../README.md).

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, pick a role card, and sign in (demo accounts are shown
directly on the `/login` screen — see `TEST_PLAN.md` §1). Everyone — Admin, Trader,
Driver, Data Entry Clerk, and the separate native Android app in `../rlts_driver_app/` —
now talks to one real server backend (see "Backend" below), so state is shared across
browsers and devices, not just across tabs of one browser.

`npm run build` type-checks and produces a production build; both are verified passing.

**For real-world test scenarios** — including step-by-step Android emulator setup for
the Driver role, and RBAC enforcement checks — see [`TEST_PLAN.md`](TEST_PLAN.md).

## What's implemented

| Requirement (README.md) | Where |
|---|---|
| Role-Based Access Control | `src/lib/auth/authStore.ts` (web) / `src/app/api/auth/login` (server, also used by the Flutter app), `src/components/RequireRole.tsx` — enforced per-page, not just a router link |
| Data entry: route, driver, cargo intake | `src/app/clerk/page.tsx`, `src/app/api/shipments/route.ts` — a new `data_entry_clerk` role that creates a shipment once; Driver and Trader see it immediately |
| Shipment correction & removal | `src/app/api/shipments/[id]/route.ts` (PATCH/DELETE), Admin's Shipment Manifest edit/delete icons — fixes bad intake data without a full `resetDemo`, which otherwise wipes every shipment |
| Multi-shipment map selector | Admin's Fleet Live Map and Trader's Live Interactive Map both let you pick which shipment the map is focused on (chips, and clickable manifest rows on Admin) — needed once there's more than one active shipment at once |
| Logistics KPI cards | `src/lib/kpis.ts` — fleet-wide counts on Admin (active/in-transit/held/customs/delayed, cargo value in transit converted to USD, gate status summary, active critical alerts), scoped-to-own-shipments counts on Trader. Deliberately count-based, not rate-based — see `LOGISTICS_GLOSSARY.md` §2 for why. Dwell time and average transit time are the two glossary cards *not* built yet, since both need data plumbing (a `DELIVERED` timestamp, paired checkpoint events) that doesn't exist — see `E2E_TEST_SCENARIO.md`'s note on the missing `DELIVERED` status. |
| Admin: gate control, broadcasts, fleet overview | `src/app/admin/page.tsx` |
| Trader: milestone timeline, live map, alerts, document viewer, cargo value | `src/app/trader/page.tsx` — scoped to that trader's own shipments |
| Driver: network detection, checkpoint actions, offline queue, photo capture, Sync Now/Sync Ref | `src/app/driver/page.tsx`, `src/lib/net/useRealNetworkState.ts`, `src/lib/sync/sync-engine.ts` — scoped to that driver's own shipment(s) |
| Native Android/iOS driver app | `../rlts_driver_app/` — separate Flutter project, same backend, see its own README |
| Currency (USD / CNY / MMK) | `src/lib/currency.ts` — `Shipment.cargoValue` + `cargoValueCurrency`, entered by the clerk, shown to Admin/Trader/Driver |
| Language toggle (EN / MM) | `src/lib/i18n/`, `src/components/LanguageToggle.tsx` — high-visibility strings only, see below |
| Visual shipment timeline | `src/components/MilestoneStepper.tsx` |
| Simulated live GPS mapping | `src/components/MapView.tsx` (inline SVG, no tile server — see below) |
| Gate/route status control with instant trader alerts | `src/app/api/gates/[id]`, `src/app/api/broadcasts`, `src/components/AlertBanner.tsx` |
| Offline capabilities | `src/lib/db/dexie-offline.ts`, `src/lib/sync/sync-engine.ts`, `src/lib/net/useRealNetworkState.ts` — tied to actual device connectivity, not only a UI toggle |

Seed data: one demo shipment `MM-TRK-8842` (Yangon → Muse) and three gates (Muse,
Myawaddy, Chinshwehaw), matching the demo script exactly. The Data Entry Clerk role adds
more shipments on top of that seed.

## Backend

**This changed mid-build** — worth knowing why. The prototype originally ran on a
browser-only backend (`localStorage` + `BroadcastChannel`), which was enough when every
role was a browser tab. The moment a *native* driver app entered the picture, that broke:
a separate OS process has no access to another app's browser storage, so "synced to
driver and trader and web portal" stopped being true.

- **Current backend (what's live):** `src/app/api/*` (Next.js route handlers) +
  `src/lib/server/db.ts`, a JSON-file-backed store behind a write-serializing queue —
  deliberately not a full database, since standing up managed Postgres wasn't worth the
  remaining time. `src/lib/store/appStore.ts` on the web side is now a thin client that
  polls `/api/state` every 2 seconds and POSTs mutations; the Flutter app
  (`../rlts_driver_app/lib/services/api_service.dart`) hits the exact same endpoints. The
  data file lives outside the deployed app's source directory in production (see
  `DEPLOY.md`) so redeploying the code doesn't wipe demo data.
- **`supabase` (ready, not wired in):** `src/lib/store/supabaseAdapter.ts` +
  `supabase/schema.sql`, unchanged in spirit from the original design — a real managed
  Postgres backend with Realtime push instead of 2-second polling, and a matching
  `apply_telemetry_event()` RPC for idempotent sync. Still the natural next step if this
  becomes a longer-lived project instead of a rapid prototype.

The 2-second poll (rather than WebSockets/Server-Sent Events) is a deliberate
reliability trade-off: a plain `setInterval` + `fetch` has far fewer ways to fail
silently mid-demo than a persistent connection, which matters more than shaving a couple
of seconds off latency for a live presentation.

## Architecture decisions borrowed from Open mSupply

Per the assignment's instruction to use `github.com/msupply-foundation/open-msupply` as a
live reference: its Rust/Postgres sync engine (V7) is far heavier than a 3-day prototype
needs — multi-site cursor-based replication, changelog windowing, scheduled de-duplication
— but three of its design *principles* map directly onto this prototype and are cited
inline in the code where used:

1. **Append-only event log, never overwritten.** `shipment_telemetry_logs` /
   `TelemetryEvent` records are only ever inserted, never edited — same as mSupply's
   changelog. See `src/lib/types.ts` (`TelemetryEvent` doc comment) and
   `supabase/schema.sql`.
2. **Idempotent apply, keyed on a client-generated UUID.** mSupply de-duplicates a
   retried sync batch at integration time so a dropped connection can't create duplicate
   history. Here, `applyTelemetryEvent()` in `src/lib/store/appStore.ts` is a no-op if the
   `eventUuid` was already applied, and the Supabase side enforces the same thing with
   `ON CONFLICT (event_uuid) DO NOTHING` in `apply_telemetry_event()`
   (`supabase/schema.sql`).
3. **`client_recorded_at` is never overwritten by `server_synced_at`.** The trader's
   timeline (`getTimelineForShipment` in `appStore.ts`) is always sorted by the event's
   own recorded time, not by when it reached the server — so a truck that spends 6 hours
   in a mountain blackout and then reconnects shows its checkpoints in the order they
   actually happened, not bunched at the reconnection moment.

These three points, with the actual mSupply doc pages they came from
(`docs/content/docs/sync/changelog-filter/_index.md` and `docs/content/docs/sync/_index.md`
in that repo), are good material for the **AI Engineering Reflection** section of the
presentation — "we used a real open-source offline-first SCM system as an architecture
reference, not just a prompt" is a stronger answer than "we asked the AI to design an
offline system."

## Deliberate simplifications (say these out loud in the reflection, don't hide them)

- **No tile-server map.** `MapView.tsx` is an inline SVG with a hardcoded Myanmar
  corridor projection, not Leaflet/Mapbox. Given the whole prototype is about
  unreliable connectivity, a map that depends on live OSM tile fetches to render is a
  bad bet for a stage demo — this trades geographic precision for demo reliability.
- **RBAC is enforced but the auth itself is fake.** `/admin`, `/trader`, `/driver` now
  genuinely require a session with the matching role (`RequireRole.tsx`) — a Trader
  account cannot open `/admin`, including by typing the URL directly (see
  `TEST_PLAN.md` §2). What's still a prototype shortcut is *how* you get a session:
  `src/lib/auth/users.ts` is a hardcoded, plaintext, client-side credential list with no
  server, no hashing, no rate limiting. Fine for a demo; real auth means wiring this to
  Supabase Auth against the roles already defined in `supabase/schema.sql`.
- **`npm audit` will show one critical/high pair.** Both come from a copy of `postcss`
  bundled *inside* Next.js 14's own build tooling (not a dependency this app's code
  calls), only fixed by jumping to Next 16 — a major-version upgrade with app-router
  changes that wasn't safe to force blind this close to the deadline. Real, but low risk
  for a prototype that isn't processing untrusted CSS input; worth a follow-up ticket
  rather than a rushed major bump.
- **SMS fallback (project_detail.md §3.5) is a generator, not a real gateway send** —
  it produces the structured payload string (`MM-TRK#SH8842#CKPT-KYAUKME#OK#LAT..#LNG..#T....`)
  in the driver UI for the demo; wiring an actual SMS gateway is out of scope for 17 days.
- **The backend is a JSON file, not a database.** `src/lib/server/db.ts` serializes
  writes through a promise chain to avoid a lost-update race, which is enough for a
  handful of concurrent demo users, not for real production load. Swapping in
  `supabase/schema.sql` (see "Backend" above) is the documented upgrade path.
- **Currency conversion uses static rates.** `src/lib/currency.ts` has hardcoded
  USD/CNY/MMK exchange rates for display only — not live, not for real settlement.
- **Language coverage is a high-visibility subset.** Page titles, nav, and primary
  buttons are translated (`src/lib/i18n/translations.ts`); form placeholders and the
  admin's free-text broadcast composer stay in English. The Myanmar strings are
  AI-translated and have not been reviewed by a native speaker — get one to check them
  before using this on stage.

## Next steps for the team

- Wire the Supabase adapter into the pages (Backend stream) if the team outgrows the
  JSON-file backend (more concurrent users, need for real persistence guarantees).
- Add second/third demo shipments on the Eastern corridor (Myawaddy) to show route
  variety beyond the one scripted shipment — or just use the Data Entry Clerk role, which
  now does this from the UI.
- Enforce roles against Supabase Auth once the adapter is wired in.
- `public/service-worker.js` (PWA asset caching, per the original proposed structure in
  project_detail.md §6) isn't implemented — the offline story here is entirely at the
  data layer (Dexie), not at the asset-caching layer. Add it if the team wants the driver
  view installable as a true PWA.
- Persist the Flutter app's language choice (`../rlts_driver_app/README.md` notes it
  currently resets on relaunch).
