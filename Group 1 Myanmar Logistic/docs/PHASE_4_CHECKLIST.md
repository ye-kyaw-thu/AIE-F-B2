# Phase 4 — Admin management and early shipment map

User requested continuation and a map if none existed. This implements Phase 4 and brings forward the map portion of Phase 6. No additional API key is required.

## Available pages

- `/admin/dashboard`: real counts and recent shipments.
- `/admin/shipments`: all authorized shipments, status filter and pagination.
- `/admin/shipments/[id]`: full details, trader/driver names, assignment, approval, status correction with a reason, history and map.
- `/admin/gates`: Open/Delayed/Closed conditions with reason validation and stale-change protection.
- `/trader/shipments/[id]`: existing details plus the same shipment map.

## Main changes

- `supabase/migrations/20260914000200_admin_workflow.sql`: authorized Admin functions with locking, revision checks and atomic history.
- `src/app/(authenticated)/admin/`, `src/lib/admin/queries.ts`, `src/components/admin/`, `src/components/layout/admin-shell.tsx`: Admin workflow.
- `src/components/tracking/shipment-map.tsx`, Trader detail page and `src/app/globals.css`: responsive Leaflet map, saved truck marker, known demo place markers, coordinate fallback and attribution.
- `scripts/generate-local-types.mjs`, generated `src/types/database.ts`, `tests/admin-workflow.test.mjs`, `scripts/test-admin-live.mjs`, package files and documentation.

## Run and verify

```powershell
npm run dev
npm run verify
# Another already-provisioned project:
npm run db:migrate
# Against the running local app:
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:admin:live
npm run test:trader:live
npm run test:live
```

The Admin live test creates its own temporary gate and shipment, exercises real authenticated forms/API calls and removes those fixtures. Existing demo gate conditions and shipment progress are preserved. The setup token is used only for fixture creation/cleanup and migrations, never application requests.

## Automated verification

- 35 local SQL tests passed, including Admin authorization, assignment visibility, approval rules, auditable corrections, assignment lock after pickup, stale revisions and gate validation.
- Production build passed with the new routes and Leaflet bundled for the browser.
- Final lint (zero warnings), TypeScript and existing hosted login/role-access regression checks passed.
- Hosted migration applied without changing prior migration files.
- Hosted Admin API and actual Server Action form tests passed assignment, approval, correction, gate editing, invalid input, stale-form/API conflicts and role/ownership isolation. All temporary fixtures were removed.
- Trader create/edit API and HTTP form regression tests passed after adding the map. Map containers, saved-position/no-position captions and Admin detail routes were verified through server rendering; this does not claim interactive map visual verification.

## Manual demo and map checks

1. Sign in as Trader (`trader@demo.com`, password `Demo-Myanmar!2026-Only`) and create a request. Open an existing In Transit demo shipment to see a truck marker; new requests correctly have no location yet.
2. Sign in separately as `admin@demo.com` with the same demo password. Open the new request, choose a driver, save assignment, then approve.
3. Confirm the assigned Driver sees the shipment and another Driver does not. Trader request editing must now be unavailable.
4. As Admin, correct status with a reason and confirm the history entry. Driver assignment must be locked after pickup/progress.
5. Open two copies of a management form. Saving the older copy after another change must show a reload message.
6. Change a gate to Delayed/Closed with a reason. Refresh a shipment using that gate and confirm the condition/note. Restore your demo gate when finished.
7. On Trader and Admin detail pages, test map pan/zoom, Find truck, popups, resize/mobile layout and visible OpenStreetMap attribution. Block tile requests and confirm the error plus readable coordinates. Navigate between shipments to check cleanup.

No browser was available through the configured browser tool, so map rendering/tiles, hydration, keyboard interaction and mobile visuals need manual verification. The map shows the latest saved simulated coordinates; it does not yet subscribe to live changes or generate GPS updates. Known place markers are approximate and unknown place names are not plotted. Driver workflow, automatic alerts, Realtime timeline and offline simulation remain later work.
