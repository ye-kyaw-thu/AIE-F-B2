# Phase 7 — Automatic gate alerts, Admin broadcasts and Trader read markers

Implemented using the existing Supabase project, migration and Realtime configuration. No additional API key or package is required.

## Available behavior

- A gate status change from Open to Delayed or Closed automatically creates one alert per Trader who has an active (non-delivered) shipment routed through that gate. Note-only updates on the same disruption status do not duplicate alerts.
- The alert includes the gate name, new status and disruption reason, plus the affected shipment number.
- Admin broadcasts create one private recipient row per Trader account. Broadcasts have no shipment or gate reference.
- Traders see their own alerts with read/unread state, type classification (Route disruption, Shipment update, Operations broadcast), linked shipment navigation and a mark-read toggle.
- Admin sees a broadcast form and the latest 50 recipient records with trader names.
- Trader layout navigation shows an unread alert count badge.
- Trader dashboard shows the three most recent alerts with a link to the full list.
- Drivers have no access to the alerts table.
- Realtime delivers alert INSERT events to subscribed Trader sessions; the live workspace refreshes automatically.

## Changed areas

- `supabase/migrations/20260916000100_gate_alerts.sql`: trigger function `create_gate_disruption_alerts`, `broadcast_alert` RPC, `mark_alert_read` RPC with execution grants.
- `src/app/(authenticated)/alerts/actions.ts`: `sendBroadcast` and `setAlertRead` Server Actions with Zod validation.
- `src/app/(authenticated)/admin/alerts/page.tsx`: Admin broadcast form, delivery list and success feedback.
- `src/app/(authenticated)/trader/alerts/page.tsx`: Trader alert inbox with type/read state, mark-read forms and shipment links.
- `src/components/alerts/broadcast-form.tsx`: Client broadcast form with pending state.
- `src/components/alerts/trader-alert-summary.tsx`: Dashboard recent-alerts widget.
- `src/app/(authenticated)/trader/layout.tsx`: Unread alert count in navigation badge.
- `tests/alerts-workflow.test.mjs`: Three local SQL tests for gate transitions, broadcasts and read markers.
- `scripts/test-alerts-live.mjs`: Hosted live test with Realtime delivery, API/HTTP form verification and cleanup.

## Verification

- All 56 local SQL tests passed, including three alert-specific tests covering gate transitions, broadcasts and read markers.
- Lint, TypeScript and optimized production build passed.
- Hosted migration `20260916000100_gate_alerts.sql` is applied; earlier migration checksums matched.
- Real gate status transition creates one private alert per active shipment owner; note-only updates do not duplicate alerts.
- Admin broadcast creates one row per Trader; Realtime delivers INSERT events to Trader sessions but not to Drivers.
- Trader mark-read/unread works for own alerts; foreign-alert and non-trader read attempts are denied.
- Admin and Trader alert pages render correctly; broadcast form submission and read-marker form submission work through actual Server Actions.

## Commands

```powershell
npm run dev
npm run verify
npm run db:migrate
# With the local app running:
$env:TEST_APP_URL = 'http://localhost:3000'
npm run test:alerts:live
```

## Manual interactive acceptance

1. As Admin, change a gate from Open to Delayed with a reason. Confirm the affected Trader's alert page shows the disruption without a manual refresh.
2. Edit the disruption note without changing status. Confirm no duplicate alert is created.
3. Change the gate to Closed. Confirm a second alert (with "Closed" title) appears for active shipments.
4. Reopen the gate. Confirm no alert is created for the Open transition.
5. As Admin, send a broadcast with a title and message. Confirm it appears for every Trader but not for Drivers.
6. As Trader, mark an alert read. Confirm the badge count decreases. Mark it unread again.
7. Verify that a different Trader cannot see or mark-read alerts belonging to the first Trader.
8. Confirm the Trader dashboard shows the recent alerts summary.
9. Deliver a shipment first, then change its route gate to Delayed. Confirm no alert is created for the delivered shipment.
