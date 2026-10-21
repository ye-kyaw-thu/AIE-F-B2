# Phase 8 — Offline Driver queue and synchronization

Implemented using localStorage for the queue and the existing `append_driver_update` RPC for sync. No additional package, migration or API key is required.

## Available behavior

- Drivers can submit status/GPS/note updates while offline (real `navigator.onLine` or simulated toggle). Updates are stored in a user-scoped versioned localStorage key with stable UUIDs.
- A **Simulate offline** button is available on the Driver shipment detail page for demo purposes.
- Pending updates show "Pending Sync" badges. A manual **Sync** button replays pending items sequentially when online.
- Synced items show "Synced" badges and can be cleared. Conflict/assignment errors show "Needs Review" with the reason and a Dismiss button.
- Queue entries are scoped to the authenticated user. A different signed-in identity cannot access or submit another user's queued entries.
- Identical UUID retries are idempotent (backed by existing database constraint). Network errors stay pending for retry; validation/assignment conflicts are surfaced for review.
- File uploads still require online connectivity.

## Changed areas

- `src/lib/offline/queue.ts`: localStorage queue with add/get/update/remove/clear operations and account isolation.
- `src/lib/offline/sync.ts`: sequential replay engine with per-item error classification.
- `src/components/driver/offline-manager.tsx`: offline toggle, sync button, queue viewer and conflict resolution UI.
- `src/components/driver/update-form.tsx`: intercepts form submission when offline and queues locally.
- `src/app/(authenticated)/driver/shipments/[id]/page.tsx`: passes userId/shipmentNumber props and renders OfflineManager.
- `src/app/globals.css`: offline queue styling.
- `tests/offline-queue.test.mjs`: 11 local tests for queue operations.

## Verification

- 11 offline queue tests passed: add/get, account isolation, UUID deduplication, update/remove/clear, pending count, corrupted storage resilience and cross-user filtering.
- TypeScript and production build passed with all offline components.
- Existing 56 database/scheduler tests remain passing.

## Commands

```powershell
npm run dev
npm run verify
node --test tests/offline-queue.test.mjs
```

## Manual interactive acceptance

1. As Driver, open an assigned approved shipment. Confirm the "Offline queue" section appears.
2. Click "Simulate offline". Confirm the banner says offline. Submit a status update. Confirm it shows "Pending Sync" in the queue.
3. Submit another update. Confirm two pending items in the queue.
4. Click "Go online". Click "Sync". Confirm both items become "Synced". Check Trader sees the updates.
5. Click "Clear synced entries". Confirm the queue is empty.
6. While offline, change status to a value that conflicts (e.g. backward). Go online, sync. Confirm "Needs Review" with an explanation.
7. Dismiss the error. Confirm it is removed from the queue.
8. Sign out and sign in as a different driver. Confirm the queue is empty (account isolation).
9. Disconnect actual network. Submit an update. Reconnect and sync. Confirm it reaches the server.
