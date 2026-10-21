# Architecture and implementation plan

## Scope

Real-Time Logistics Monitoring for Myanmar Trading is a university MVP. Phases 1–5 provide the foundation, Trader/Admin workflows, maps, mobile Driver updates and private evidence. Phase 6 adds authorized Realtime refresh, milestone aggregation and connection indicators. Phase 7 implements automatic gate disruption alerts, Admin broadcasts and Trader-only read markers. Offline synchronization remains Phase 8. The public overview uses explicitly labeled static fixtures and exposes no real operational data.

Trader forms use React action state and authenticated Server Actions with shared Zod validation. Database functions independently validate role, ownership and payloads, then commit the shipment and history event in one transaction. Edits lock the row and compare its revision timestamp to prevent stale overwrites. Server reads remain uncached; successful writes revalidate affected routes. List filters and pagination run against the trader's authorized rows. No new package was needed for Phase 3.

## Architecture

- Next.js App Router, React, strict TypeScript, and Tailwind CSS. Server Components render layouts and initial authenticated reads; small Client Components handle forms, subscriptions, Leaflet, and the offline queue.
- Supabase provides Auth, PostgreSQL, Realtime, and a private Storage bucket. Use `@supabase/ssr` for cookie-aware browser/server clients. Server checks verify identity and the database role before rendering role routes. Database RLS and constrained mutation functions enforce authorization independently of the UI.
- No separate backend, ORM, global state framework, paid mapping service, or production offline service worker.
- Mutations use validated server actions or narrowly scoped database functions with the signed-in user's session. Never use an elevated Supabase key for ordinary application requests.
- Realtime subscribes to authorized shipment, update, gate, document and alert changes; it refetches authorized data on reconnect. Realtime is notification transport, while PostgreSQL remains the source of truth.
- Leaflet loads on the client, with OpenStreetMap attribution. Drivers can select demo coordinates or explicitly capture device location; map labels therefore say reported GPS. No road routing or continuous tracking is implemented. Initial demo positions: Yangon `(16.8409, 96.1735)`, Mandalay `(21.9588, 96.0891)`, Muse `(23.9869, 97.9040)`, Myawaddy `(16.6891, 98.5089)`. Demo coordinates and gate statuses are illustrative, not travel advice.
- Phase 8 will store text/status/GPS update payloads in localStorage under a user-scoped versioned key. File uploads require connectivity in this prototype. Planned queue entries use stable UUIDs for safe retry and must never be submitted under a different signed-in identity.

## Planned structure

The tree below records the original Phase 1 plan; current Phase 3 files are listed in `PHASE_3_CHECKLIST.md`.

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx                         # static foundation preview
    loading.tsx / error.tsx / not-found.tsx
    login/page.tsx                   # Phase 1 explanatory placeholder
    (authenticated)/                # later: verified session boundary
      layout.tsx
      admin/
        dashboard/page.tsx
        shipments/page.tsx
        shipments/[id]/page.tsx
        gates/page.tsx
        alerts/page.tsx
      trader/
        dashboard/page.tsx
        shipments/page.tsx
        shipments/new/page.tsx
        shipments/[id]/page.tsx
        alerts/page.tsx
      driver/
        dashboard/page.tsx
        shipments/[id]/page.tsx
  components/
    layout/app-shell.tsx
    ui/status-badge.tsx
    ui/icon.tsx
    shipments/                      # later: request form, table, timeline
    tracking/                       # later: Leaflet map and subscriptions
    driver/                         # later: update form and sync queue
  lib/
    demo-data.ts                     # display-only fixtures
    supabase/                       # later: server.ts, client.ts, session.ts
    validation/                     # later: shared Zod schemas
    offline/                        # later: queue and sync functions
  types/domain.ts
  proxy.ts                          # later: session refresh; not authorization alone
docs/
  ARCHITECTURE.md
  DATABASE_DESIGN.md
  PHASE_1_CHECKLIST.md
supabase/                           # later: migrations, seed configuration
scripts/                            # later: demo Auth user provisioning
.env.example
AI_ENGINEERING_LOG.md
README.md
```

## Packages

Installed in Phase 1 (exact resolved versions are in `package-lock.json`):

| Package | Purpose |
| --- | --- |
| `next`, `react`, `react-dom` | Application and rendering |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Static typing |
| `tailwindcss`, `@tailwindcss/postcss` | Styling |
| `eslint`, `eslint-config-next` | Code checks |

Add when used in later phases:

| Package | Phase / purpose |
| --- | --- |
| `@supabase/supabase-js`, `@supabase/ssr` | 2: database, authentication, cookie sessions |
| `zod` | 2–3: validate environment and mutation payloads |
| `leaflet`, `@types/leaflet` (dev) | Installed in Phase 4 at user request; client-only map using an effect and dynamic library import |
| `@playwright/test` (dev) | 9: role-isolation and live demo regression tests |

Native React forms, Intl date formatting, CSS icons, and localStorage keep the dependency set small. Supabase types will be generated from the applied schema rather than hand-written API types.

The map imports Leaflet only in the browser, cleans up maps and resize observers on unmount, and uses DOM text for user-supplied popup content. Markers never invent a truck position when coordinates are absent. Only Yangon, Mandalay, Muse and Myawaddy have approximate demo place markers; unknown names are not geocoded. OpenStreetMap attribution remains visible and tiles load on demand under the [standard tile policy](https://operations.osmfoundation.org/policies/tiles/), using the [Leaflet API](https://leafletjs.com/reference). GPS changes move the existing marker without recreating the map or resetting the user's zoom/pan. Find truck explicitly recenters it.

The authenticated layout owns one Realtime subscription lifecycle per user and route. INSERT/UPDATE events request a debounced `router.refresh()`; payloads never bypass authorized server reads. Joining/rejoining and returning to a visible tab trigger reconciliation, with a 30-second fallback for missed events and old-driver reassignment visibility. Refresh is suspended offline, while hidden, during another refresh, or while editing a shipment form. Draft snapshots retain their original revision even if an earlier refresh finishes during editing. Navigation resets the draft guard; Reload latest explicitly discards drafts. Initial session/connection failures retry, SDK heartbeats update connection state, and unmount/sign-out clears subscriptions, timers and listeners. See [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

`shipment_milestones` aggregates the complete authorized history independently of the recent-20 list. The seven-stage timeline distinguishes current status, recorded stages, missing milestones and prior progress retained after an Admin correction. Publishing excludes DELETE/TRUNCATE because deleted-row events cannot use row-level SELECT authorization; ordinary workflows do not delete shipments. Gate alert generation remains Phase 7, even though the existing alerts table is subscribed.

Driver text/GPS updates use a stable Server Action and a session-scoped RPC. The RPC locks the assignment, validates progress and revision, then writes history and current status/GPS together. A UUID and captured timestamp identify retries; identical committed payloads return the existing result without changing current state again. Files upload directly from the browser with the authenticated Supabase client, avoiding large Server Action bodies. Storage RLS checks ownership/path; metadata registration verifies the uploaded object's recorded MIME and size. Authorized download routes issue 60-second attachment links with no-store responses. See [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [signed downloads](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl).

## Phase acceptance gates

1. Scaffold, base responsive layout, environment example, schema/architecture design, README, and AI log. Verify lint, TypeScript, production build, and HTTP routes. **Stop for user review.**
2. Apply migrations and RLS; implement login/session refresh; provision demo accounts; verify cross-role access and role escalation rejection through direct database API requests.
3. Trader create/list/detail, validation and own-shipment isolation.
4. Admin assignment, approval, status correction, and gate management.
5. Mobile driver status/GPS/evidence workflow and assigned-shipment authorization.
6. Realtime subscriptions, timeline, map, and reconnect refetch.
7. Automatic affected-trader gate alerts, broadcasts, and read markers.
8. Offline queue, pending state, manual sync, idempotent retry, and account isolation.
9. Full demo and negative authorization tests, failure handling, responsive verification.
10. Vercel deployment, demo reset, and presentation preparation.

## Reference documentation

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase user profiles](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
