# Phase 5 — Driver mobile workflow

Implemented with the existing Supabase configuration; no additional key or package is needed.

## Available behavior

- Mobile Driver dashboard with paginated assignment cards and shipment details.
- Status/note updates and one-tap **Use my location** capture with browser permission. Demo GPS presets remain available; manual coordinates are under Advanced. Saved history and Synced confirmation follow submission.
- Database-enforced assignment/approval, forward progress, stale-revision protection and idempotent UUID retries. Delivered progress is locked.
- JPEG, PNG or PDF evidence up to 10 MiB; uploads require internet and JavaScript. Receipts may still be attached after delivery.
- Evidence lists and protected downloads for the assigned Driver, owning Trader and Admin. Unrelated users and public URLs cannot access files.
- Updated history and saved GPS appear on Trader/Admin details after refresh. Realtime and offline UI are later phases.

## Main changed files

- `supabase/migrations/20260914000300_driver_workflow.sql` and generated `src/types/database.ts`.
- `src/app/(authenticated)/driver/`, `src/lib/driver/queries.ts`, `src/components/driver/`, `src/components/layout/driver-shell.tsx`.
- `src/components/shipments/documents.tsx`, `/documents/[id]/download/route.ts`, Trader/Admin details, Proxy and CSS.
- `tests/driver-workflow.test.mjs`, `scripts/test-driver-live.mjs`, local Storage test harness, package scripts and documentation.

## Commands

```powershell
npm run dev
npm run verify
# For another already-provisioned project:
npm run db:migrate
# Live API/Storage tests, optionally with the running local app:
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:driver:live
```

The live test creates its own shipment and tiny image fixture, then removes its Storage objects, evidence and history. Its setup token obtains a privileged key only in script memory for cleanup through the Storage API. All tested application operations use real user sessions and the publishable key. No privileged key is used by the app.

## Verification evidence

- 46 local SQL tests passed: role/assignment isolation, progress/coordinate validation, atomic history, duplicate/stale retries, delivery lock, Storage paths, metadata registration, private visibility and orphan cleanup.
- Lint, TypeScript and production build passed.
- Hosted Driver API checks passed approval/access restrictions, progress/GPS updates, UUID retries and delivered-state rejection.
- Real private Storage upload passed; incorrect metadata, foreign access and public download were denied. Admin/Trader/Driver signed downloads returned the exact uploaded bytes. Registered evidence survived a Driver deletion attempt; unregistered upload cleanup passed.
- Actual production HTTP Driver form validation/update/retry passed. Admin and Trader pages showed the saved history/coordinates/evidence. Authorized download routes returned private redirects; unrelated viewers received 404.
- All temporary Phase 5 records/files were cleaned up.
- Existing Admin and Trader live form/API regressions and all login/role-access regression checks passed after the Driver changes.

## Manual acceptance

1. Create a Trader request; as Admin assign `driver@demo.com` and approve it.
2. Sign in as Driver with `Demo-Myanmar!2026-Only`. Open the assignment, mark Picked Up, select a simulated GPS preset and save.
3. Confirm Synced and the new history entry. Refresh the Trader/Admin detail page and confirm the status and truck position changed.
4. Advance to Arrived at Checkpoint with a note. Open a stale form in another tab and confirm it cannot silently overwrite a newer update.
5. Upload a JPEG/PNG photo or PDF, then download it as Driver, Trader and Admin. Verify a second Trader/Driver cannot open that evidence link.
6. Mark Delivered. Confirm progress controls disappear but receipt upload remains available.
7. Review at a narrow mobile width: touch targets, GPS presets, file picker, pending/error states, keyboard focus and map behavior. Test a wrong-format file and one exceeding 10 MiB.
8. On HTTPS (or localhost), press Use my location, grant permission, and confirm the accuracy message and populated Advanced fields. Save and check the reported position. Also test denied permission, unavailable/slow location, cancellation, and choosing a demo preset while a location request is pending; a late device response must not replace the selected preset. Plain HTTP over a phone's LAN address cannot access device location.

Device location uses a one-time browser request with high accuracy requested, a 15-second acquisition timeout and no cached position. It is never requested on page load, and is not sent to the app database until Save shipment update. Browser accuracy varies; no continuous/background tracking is implemented. See [browser geolocation requirements](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition). This refinement passed lint, TypeScript and production build; real device permission/accuracy checks remain manual.

The configured browser tool reported no available browser, so file-picker/hydrated interaction and visual/mobile QA remain manual. Header recognition in the upload UI is format validation, not a malware scanner. A network interruption can prevent cleanup of an unfinished upload; reload evidence before retrying. Offline uploads/queue, automatic shipment alerts and live subscriptions are not included in this phase.
