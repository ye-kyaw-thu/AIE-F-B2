# Phase 3 — Trader shipment workflow

Implemented and applied to the configured Supabase project. No additional API key is needed.

## Available behavior

- Trader dashboard with real summary counts, recent shipments and request navigation.
- Own-shipment list with status filters, 20-row pagination and useful empty/error states.
- Create form with all requested fields, quantity units, Myanmar-local pickup-date validation, gate condition notices, inline errors and saving state.
- Details with cargo, route, gate condition, assigned driver name, status, timestamps and 20 recent recorded updates.
- Request editing while status is `requested`; database ownership/status checks and revision comparison also apply to direct API calls.
- Atomic shipment/event writes; no client control over owner, assignment, status, number or coordinates.

## Main files changed

- `src/app/(authenticated)/trader/`: layout, dashboard, shipment list/new/detail/edit pages, actions, loading and not-found states.
- `src/components/layout/trader-shell.tsx`, `src/components/shipments/request-form.tsx`, `src/components/shipments/shipment-list.tsx`, `src/app/globals.css`.
- `src/lib/shipments/queries.ts`, `src/lib/shipments/validation.ts`, generated `src/types/database.ts`.
- `supabase/migrations/20260913000200_trader_workflow.sql` and `20260914000100_trader_conflict_responses.sql`.
- `scripts/lib/migrations.mjs`, `scripts/migrate-supabase.mjs`, existing setup/local database/type generation scripts, `package.json`.
- `tests/trader-workflow.test.mjs`, `scripts/test-trader-live.mjs`, README, architecture/database docs and AI engineering log.

## Commands

```powershell
npm run dev
npm run verify
# Apply pending migrations on another already-provisioned project:
npm run db:migrate
# Real API tests; temporary verification rows are removed in cleanup:
npm run test:trader:live
# Also exercise actual Server Actions against your running local app:
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:trader:live
npm run test:live
```

Hosted tests require the existing demo fixtures. Trader tests use `SUPABASE_ACCESS_TOKEN` only to delete their marked temporary test shipments and dependent events. App code never uses this token. On a fresh project, run `npm run setup:supabase` first.

## Verification evidence

- `npm run verify`: zero-warning lint, TypeScript, all 28 local SQL security/workflow tests and optimized production build passed.
- Hosted workflow API checks passed: initial requested/unassigned state, initial event, Admin visibility, unrelated trader/driver isolation, privileged-field/invalid-input rejection, concurrent edit conflict and rejection of edits after approval.
- Authenticated production HTTP checks on port 3100 passed for list/filter/detail/edit pages, hidden foreign details, disabled active-shipment editing, invalid form validation and actual create/edit Server Action submissions. Temporary verification shipments/events were removed.
- Existing hosted Auth/API/HTTP regression checks passed for all five accounts, role isolation, privileged-write denial, anonymous rejection and cross-role route redirects.
- In-app browser discovery returned no available browser. Visual layout, hydrated input behavior and mobile interactions have not been verified automatically.

## Manual acceptance

1. Open `/login`, sign in as `trader@demo.com` with `Demo-Myanmar!2026-Only`.
2. Choose New request. Enter Yangon → Muse, cargo details, a positive quantity, today/future pickup date and Muse gate. Submit and confirm the new detail page shows Requested and no assigned driver.
3. Open My shipments, filter Requested, and confirm the request appears. Open it and edit the quantity; confirm the changed value and new history entry.
4. Open the same edit form in two tabs. Save one; submitting the older tab should show a conflict with a link to the latest shipment.
5. Open an existing In Transit shipment and confirm editing is unavailable. Sign in as `trader2@demo.com` separately and confirm it cannot view the first trader's shipment URL.
6. Sign in as Admin in a separate browser profile and confirm the new request appears on its dashboard.
7. Review forms/navigation at desktop and mobile widths, including validation messages and keyboard focus.

Realtime refresh, the full tracking timeline/map, Admin approval/assignment, driver updates, alerts and offline simulation belong to later phases. Phase 4 has not been started.
