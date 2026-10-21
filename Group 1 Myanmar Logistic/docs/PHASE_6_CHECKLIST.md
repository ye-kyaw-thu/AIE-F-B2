# Phase 6 — Realtime tracking, timeline and map

Implemented using the existing Supabase project and map dependencies. No additional API key is required.

## Available behavior

- Trader, Admin and Driver pages refresh automatically after authorized shipment, history, gate, evidence or existing alert records change.
- Connection banner shows Connecting, Live, Reconnecting or Offline. Rejoining and returning to a visible tab refetch current data; a 30-second check covers missing events such as revoked driver assignments.
- Incoming bursts coalesce into a single refresh. Offline/hidden pages and active forms pause refresh; navigation or Reload latest resumes a fresh view. Reload latest discards any unsaved draft. A database conflict still requires reviewing the latest record.
- Draft revisions remain pinned during editing, including when an already-running refresh completes. Same-page save redirects that retain a draft pause can be followed with Reload latest before another operation.
- All three detail pages show the seven-stage timeline. Aggregation includes events older than the recent-20 history list, leaves skipped stages unrecorded and preserves milestones after status correction.
- The existing truck marker moves when another saved position arrives, preserving pan and zoom. Find truck recenters the map. Device location is still captured only on request and shared only on Save; this is not continuous GPS collection.

## Changed areas

- `supabase/migrations/20260915000100_realtime_tracking.sql`, generated database types.
- Authenticated layout; `src/components/tracking/` and `src/lib/tracking/`.
- Trader/Admin/Driver detail pages and draft handling in their forms; shared CSS.
- `tests/tracking.test.mjs`, `scripts/test-realtime-live.mjs`, package scripts and project documentation.

## Verification

- 53 local tests passed: 50 database security/workflow/aggregation checks and three refresh-scheduler tests.
- Lint, TypeScript and production build passed.
- Hosted migration applied without changing earlier migration checksums or reseeding existing records.
- Genuine WebSocket INSERT/UPDATE delivery passed for status/GPS, history, evidence metadata, gate state and alert metadata. Test subscriptions intentionally omit client filters to verify database-enforced isolation.
- Unrelated Trader/Driver and anonymous sessions received no private shipment or evidence data. Drivers received no trader alerts. Gate events reached authenticated roles only.
- Disconnect, missed update, reconnect/rejoin, authorized refetch and subsequent event delivery passed. Explicit channel removal and logout stopped subsequent delivery.
- Production HTTP pages for all three roles showed the saved GPS, history, milestone labels and live controls.
- Existing Admin, Trader and authentication regressions passed. Driver form validation/save/retry, private Storage upload, authorized downloads, foreign denial and delivered-state rejection passed against the final production build.
- Test-created shipment, gate, history, document metadata and alert metadata were removed. The metadata fixtures test subscriptions only; they do not implement automatic alert generation or substitute for the separate real Storage upload tests.

## Commands

```powershell
npm run dev
npm run verify
# Only needed when applying pending migrations to another provisioned project:
npm run db:migrate
# With the local app running:
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:realtime:live
```

The live test needs the setup token only for isolated fixture creation/cleanup. Application operations and subscriptions use ordinary authenticated sessions with the publishable key.

## Manual interactive acceptance

The browser connector reported no available browser. Hydrated interactions, map rendering and mobile visuals have not been automated here.

1. Use separate browser profiles for Trader, Admin and Driver. Create a fresh request, assign the Driver and approve it. Check that lists and detail statuses update without pressing Refresh.
2. Keep the Trader detail open. As Driver, select Picked Up, choose a demo location (or Use my location with permission), and save. Confirm Trader history, timeline and map change automatically.
3. Pan/zoom the Trader map, then save another Driver position. Check that the existing marker moves and zoom stays unchanged; Find truck recenters it.
4. Skip a stage and verify it says No milestone recorded. Correct progress backward as Admin and confirm the later recorded stage remains visible. Do not use shared seeded shipments for destructive demo changes.
5. With a detail page already open, disconnect its network. Confirm Offline; save an update from another online browser, reconnect and confirm catch-up and Live. Also switch tabs away/back and repeat after a failed initial connection.
6. Start editing an Admin gate/shipment form or a Driver/Trader form. Update that record elsewhere. Confirm the draft is preserved, automatic refresh shows paused, and a stale submission cannot overwrite the newer revision. Reload latest discards the draft and shows current data.
7. Reassign an uncollected shipment to the second Driver. The former Driver should lose it after reconciliation (up to 30 seconds while visible and not editing). Database reads/writes must reject that Driver immediately.
8. Sign out, switch accounts and navigate repeatedly. Check that old data disappears and no duplicate update handling accumulates. Repeat a second save from a `?saved=1` page; reload if the form pause remains.
9. Check narrow mobile layouts, timeline labels, map fallback, keyboard navigation, evidence uploads and downloads.

Automatic gate alerts/broadcasts are Phase 7. Offline queuing/manual sync are Phase 8; Offline currently describes connection state and does not queue submissions.
