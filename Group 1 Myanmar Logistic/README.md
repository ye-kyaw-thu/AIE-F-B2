# Real-Time Logistics Monitoring for Myanmar Trading

AI Engineering Assignment 5 — a phased, demo-focused logistics MVP built with LLM-assisted coding.

**Current status: Phases 1–8 implemented; Vercel deployment is reachable.** This update adds a redesigned public landing page, bundled Newsreader / IBM Plex Sans fonts, Trader signup and email confirmation, and matching login. Drivers can queue updates from an open page and sync manually. Production email settings and Phase 9 acceptance remain pending. See the [project review and deployment checklist](docs/PROJECT_REVIEW_2026-09-17.md) for verified findings and next steps.

## Run locally

Prerequisite: Node.js 22 LTS or newer compatible LTS, and npm. This workspace was initialized with Node 22.16.0 and npm 10.9.2.

```powershell
cd D:\AI-Engineering-Batch2\Assignment5-Logistics
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Dependencies are already installed in the current workspace, so you can run `npm run dev` immediately. Copy the environment example only if `.env.local` does not already exist; never overwrite real credentials. Open [http://localhost:3000](http://localhost:3000). Stop with Ctrl+C.

```powershell
npm run check    # ESLint plus Next.js route generation and TypeScript
npm run build    # Production compilation
npm start        # Serve a successful production build
```

`npm run verify` runs lint, TypeScript, 68 local database/scheduler/queue tests, 7 signup/language tests and the production build. Existing queue tests duplicate implementation and need replacement with direct module coverage. If port 3000 is busy, use `node node_modules/next/dist/bin/next dev -p 3001`. Fonts are served by the app; authenticated pages contact Supabase. The interface defaults to Burmese, with a persistent English/Burmese switch; see [language support](docs/BURMESE_LANGUAGE.md).

## Purpose and roles

The final prototype helps Myanmar traders coordinate cross-border shipments, follow simulated truck locations, and receive route disruption alerts.

| Role | Planned access |
| --- | --- |
| Admin | All shipments; assignment, approval, status correction, gate management, broadcasts |
| Trader | Own shipment requests, progress, documents, and alerts |
| Driver | Assigned shipments only; mobile status, simulated GPS, evidence upload, offline update queue |

Role-specific layouts, page/data guards and database RLS enforce access. Phase 3 adds validated create/edit functions that derive trader identity from the session and reject privileged fields. Direct operational table writes remain denied. Hiding a button is never the only authorization check.

## Architecture and technology

Next.js App Router + React + strict TypeScript + Tailwind CSS. Supabase provides PostgreSQL, Auth, private Storage and Realtime. Leaflet + OpenStreetMap renders shipment maps without another API key. A user-scoped localStorage queue will simulate offline text/status/GPS updates in Phase 8; documents upload online.

Installed foundation: Next.js 16.3.5, React 19.2.8, Tailwind CSS 4, TypeScript 5, ESLint 9. Phase 2 adds `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only` and the development-only PGlite SQL test runtime. Exact versions are locked in `package-lock.json`. The full planned directory tree is in [Architecture](docs/ARCHITECTURE.md).

Current structure:

```text
src/app/                   Overview, login/action, protected role layouts/dashboards
src/proxy.ts               Supabase session cookie refresh
src/lib/auth/              Verified identity, roles and login validation
src/lib/supabase/          Typed browser/server clients and configuration
src/components/layout/     Shared responsive application shell
src/components/ui/         Icons and status badges
src/lib/demo-data.ts        Explicitly static preview fixtures
src/types/domain.ts        Role, gate, shipment and sync domain types
src/types/database.ts      Generated migrated database types
supabase/migrations/       Versioned schema and RLS migration
scripts/                   Hosted setup, connection/API tests and type generation
tests/database.test.mjs     Executable PostgreSQL security tests
docs/                      Architecture, schema contract, Phase 1 checklist
.env.example               Public Supabase configuration placeholders
AI_ENGINEERING_LOG.md      Prompts, decisions, detected issues and fixes
```

## Feature roadmap

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1 | Scaffold, layout, schema design and documentation | Implemented; manual visual review pending |
| 2 | SQL migrations, Auth, session checks, RLS and demo users | Complete; local and hosted checks passed |
| 3 | Trader shipment requests/list/details/edit | Complete; local and hosted checks passed; visual review pending |
| 4 | Admin assignment, approval and gate management | Implemented; see Phase 4 verification checklist |
| 5 | Driver mobile updates, GPS simulation and uploads | Implemented; SQL/API/HTTP checks passed; mobile visual review pending |
| 6 | Realtime timeline and Leaflet map | Implemented; SQL, WebSocket and HTTP checks passed; interactive review pending |
| 7 | Automatic gate alerts and broadcasts | Implemented; SQL, API and Realtime checks passed |
| 8 | Offline queue and manual synchronization | Implemented; queue tests passed |
| 9 | End-to-end demo and security tests; fixes | Planned |
| 10 | Deployment and demo preparation | Vercel reachable; production Auth configuration and final acceptance pending |

## Database and Supabase setup

The final schema contract is in [Database design](docs/DATABASE_DESIGN.md), including every column, foreign key, check, index, mutation rule and RLS access matrix for:

- `profiles`
- `shipments`
- `shipment_updates`
- `gate_statuses`
- `alerts`
- `documents`

For a new project, follow [Phase 2 setup](docs/PHASE_2_SETUP.md) and run `npm run setup:supabase` to apply all migrations and seed demo accounts. For an existing project, use `npm run db:migrate` to apply only pending migrations without reseeding. Both require the server-only personal access token in `.env.local`; the publishable key cannot administer the schema. Applied migrations are checksum protected: add a new migration for changes. Do not apply files separately in the SQL editor and then run the setup script, since that would leave migration history out of sync.

The phased setup will:

1. Create or connect a Supabase project.
2. Apply reviewed versioned schema migrations and enable/test RLS.
3. Configure email/password Auth and allowed localhost/production redirect URLs.
4. Populate public project URL and publishable key in `.env.local`.
5. Provision demo Auth users using a trusted setup script and seed profiles, gates and shipments.
6. Configure a private `shipment-documents` bucket with scoped Storage policies (uploads are wired in Phase 5).
7. Add authorized tables to the Realtime publication in Phase 6.

No privileged Supabase key goes into client code. Normal app requests use the authenticated session. Elevated setup credentials, if needed, remain server-only. Role values cannot be selected during public signup or changed through user metadata.

## Environment variables

| Name | Purpose | Current requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Full Supabase project URL | Required for login |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key; database access protected by RLS | Required for login |
| `NEXT_PUBLIC_APP_URL` | App origin for future redirects | `http://localhost:3000` |
| `SUPABASE_ACCESS_TOKEN` | Server-only personal token for setup scripts | Needed only for hosted migration/provisioning |

`.env.local` is ignored; `.env.example` is intentionally tracked. Do not add a service-role/secret key to a variable beginning with `NEXT_PUBLIC_`.

## Demo accounts and data

**Provisioned and verified in the configured project.** On a new project, run `npm run setup:supabase` first.

| Role | Email |
| --- | --- |
| Admin | `admin@demo.com` |
| Trader | `trader@demo.com` |
| Driver | `driver@demo.com` |

Development-only shared demo password: `Demo-Myanmar!2026-Only`. This is public documentation, so use it only for isolated demo accounts with sample data, never real users.

The public visual fixtures contain Yangon → Muse, Yangon → Myawaddy, and Mandalay → Muse. The setup script creates these in Supabase with gates initially Open. It also provisions `trader2@demo.com`, `driver2@demo.com`, and one separate shipment to prove isolation. They use the same demo password. Seeded positions and gate conditions are simulated.

Drivers can tap **Use my location**, allow browser permission, then save the update without typing coordinates. Device location requires HTTPS or localhost; plain HTTP over a phone's LAN address will not work. Demo locations remain available, and manual fields are under Advanced. Location is captured once on request and saved only with the shipment update; continuous tracking is not implemented.

## Exact live demo scenario

This is the acceptance script for the completed MVP. All features are available: Driver updates, gate management, automatic history/map refresh, gate disruption alerts and offline synchronization. Live refresh pauses while interacting with a shipment form; navigate or use Reload latest when ready to discard the draft and catch up. Before the final demo, reset the demo Muse gate to Open and use a fresh requested shipment. Choose a current/future pickup date. Use separate browser profiles/incognito sessions to show multiple roles simultaneously.

1. Login as Trader.
2. Create a Yangon → Muse shipment request.
3. Login as Admin.
4. Confirm the new shipment appears.
5. Assign the demo Driver.
6. Approve the shipment.
7. Login as Driver.
8. Mark the shipment Picked Up.
9. Update simulated GPS location.
10. Confirm Trader sees the updated timeline and map.
11. As Admin, change Muse Gate from Open to Closed and add a reason.
12. Confirm the system automatically creates an alert for the affected trader.
13. Confirm Trader sees “Muse Gate Closed.”
14. As Driver, turn on simulated offline mode.
15. Submit Arrived at Checkpoint.
16. Confirm the local update shows Pending Sync and has not reached Supabase.
17. Restore connectivity / disable simulated offline mode.
18. Press Sync and confirm the pending update becomes Synced.
19. Confirm Trader sees the new shipment status.

## Deployment plan (Phase 10)

The standard Next.js project is compatible with Vercel; deployment has not been performed.

1. Push the reviewed project to your repository.
2. Import it in Vercel using the Next.js preset, repository root, install command `npm ci`, and build command `npm run build`.
3. Configure public Supabase environment values and set `NEXT_PUBLIC_APP_URL` to the deployment origin for each environment.
4. Apply database migrations separately to the intended Supabase project; a Vercel build does not migrate the database.
5. Configure Supabase Auth site/redirect URLs for the final origin.
6. Validate role isolation, Realtime, private downloads and the exact demo scenario over HTTPS.
7. Keep sample data and demo credentials confined to a demo project.

The root overview remains public sample data. Authenticated deployment requires the two public Supabase values and a provisioned database. Never deploy the setup personal access token as application configuration.

## Verification and limitations

See [Phase 7 acceptance](docs/PHASE_7_CHECKLIST.md), [Phase 6 acceptance](docs/PHASE_6_CHECKLIST.md), [Phase 5 acceptance](docs/PHASE_5_CHECKLIST.md) and [Phase 2 setup](docs/PHASE_2_SETUP.md). Real WebSocket delivery, role isolation, reconnect catch-up, production page responses, Driver submissions, private uploads/downloads, gate alerts and broadcast delivery were tested. Browser rendering, file-picker interaction, hydration and mobile interactions require manual review because no in-app browser was available. Maps require internet; shipment coordinates remain visible as text if tiles fail. No geocoding, road routing, continuous device tracking, tile prefetch or offline tile downloads are implemented.

See [AI engineering log](AI_ENGINEERING_LOG.md) for important prompts, generated components, architecture decisions, and actual issues encountered.
