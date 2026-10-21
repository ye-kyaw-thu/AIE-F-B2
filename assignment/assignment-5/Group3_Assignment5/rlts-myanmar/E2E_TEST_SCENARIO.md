# End-to-End Test Scenario — Full Shipment Lifecycle

One continuous walkthrough of a shipment's whole life, across every surface the system
has: Data Entry Clerk (web), Admin (web), Trader (web), Driver (both the web PWA and the
native Android app), talking to the one real backend at `http://136.85.81.202:3000`.
This is the scenario to run before a rehearsal or a demo — if every step below passes,
the system is presentation-ready. For granular, single-feature test cases, see
`TEST_PLAN.md`; this document is the thread that ties them together in the order a real
shipment would actually move.

**Cast:**

| Role | Account | Surface |
|---|---|---|
| Data Entry Clerk | `clerk` / `clerk123` | Web browser |
| Admin / Dispatcher | `admin` / `admin123` | Web browser |
| Trader | `trader2` / `trader123` | Web browser |
| Driver | `driver2` / `driver123` | **Both** the web PWA (Android emulator's Chrome) and the native Flutter app |

Using `trader2`/`driver2` rather than the seeded `trader`/`driver` accounts so this
scenario creates and follows a *new* shipment end to end, instead of reusing
`MM-TRK-8842`'s existing history.

**Setup:** four browser tabs (or windows) signed into Admin, Trader, and Clerk; the
Android emulator with both Chrome and the native app installed for Driver. Start from a
clean slate: Admin → **Reset demo state**.

---

## Part 1 — Intake (Clerk)

1. Sign in as `clerk` / `clerk123`.
2. Create a shipment: Assign Driver = **Daw Hla Hla Win**, Trader/Customer = **Irrawaddy
   Exports Ltd.**, Corridor = **Eastern (Thailand) — Myawaddy**, Cargo Type =
   "Electronics", Weight = 5, Cargo Value = 10000, Currency = **CNY**, Tracking # left
   blank.
3. **Expect:** green confirmation, form clears, a new tracking number appears (e.g.
   `MM-TRK-####`). Note it down — call it `TRACKNO` for the rest of this script.

## Part 2 — The shipment reaches its people (data propagation)

4. Switch to the Trader tab, signed in as `trader2`. Search `TRACKNO`.
   **Expect:** it appears within ~2 seconds (the state poll interval), showing Cargo
   Value formatted as `¥10,000`, status `Booked / Depot Pickup`.
5. On the Android emulator, open the native app, sign in as `driver2`.
   **Expect:** the app shows `TRACKNO`, Yangon → Myawaddy, Electronics, and the same
   `¥10,000` cargo value — pulled from the same server the Trader tab just read from,
   not a separate copy.

## Part 3 — Driver goes dark (real offline, not simulated)

6. On the emulator, open Extended Controls → Cellular, and set Data status to
   **Denied** (or toggle Airplane Mode from the quick-settings shade).
7. In the native app, confirm the network indicator flips to **OFFLINE** on its own —
   nothing was tapped in the app itself.
8. Tap **Arrived at Checkpoint**, with a note ("Reached Hpa-An checkpoint") and a
   camera-captured photo.
   **Expect:** instant queue entry, `QUEUED_LOCALLY`, no spinner, no error — the offline
   queue writes locally before ever touching the network.

## Part 4 — Meanwhile, back at dispatch (independence of gate alerts from driver state)

9. Switch to the Admin tab. Close the **Myawaddy Border Gate**, reason: "Flooding on
   approach road." Send a broadcast: severity `CRITICAL`, gate = Myawaddy, message
   "Myawaddy crossing flooded — expect rerouting."
10. Switch to the Trader tab.
    **Expect:** within ~2 seconds, a red pulsing banner with a chime — this happens
    regardless of the driver being offline right now, proving gate alerts don't depend on
    driver connectivity at all; they're two independent paths through the same backend.

## Part 5 — Reconnect and sync (the actual point of the assignment)

11. Back on the emulator, turn Data status back to allowed (or disable Airplane Mode).
12. In the native app, confirm the network indicator flips back to **ONLINE**
    automatically, and the queued checkpoint event syncs within moments — status flips
    to `SYNCED`, and a `Sync Ref:` code appears (e.g. `SYNC-XYZ123-AB12`). Tap **Sync
    Now** once more manually to confirm the explicit path also works, not just the
    automatic one.
13. Switch to the Trader tab, open the Document & Inspection Viewer for `TRACKNO`.
    **Expect:** the checkpoint event appears with the photo, and its "Recorded" timestamp
    matches when it was actually logged in Part 3 — not the later time it happened to
    sync. This is the append-only, idempotent design (see `README.md`'s "Architecture
    decisions borrowed from Open mSupply") actually working, not just claimed.

## Part 6 — Cross-client consistency (native app vs. web driver)

14. On the same emulator, open **Chrome** and sign in to the web driver page as
    `driver2` (a second, independent client for the same account).
    **Expect:** the web driver page shows the *same* shipment, the *same* Local Queue
    history (`SYNCED` Arrived event included) — because both clients read from the one
    real backend, not two separate demo states.
15. From the **web** driver page this time, tap **Inspection Passed**.
    **Expect:** queues and syncs the same way; switch to Trader and confirm the
    milestone stepper advances to "In Transit" and `isDelayed` clears.

## Part 7 — Resolution

16. Admin: change the Myawaddy gate back to `OPEN`, with a note ("Road cleared, crossing
    reopened"). Dismiss the earlier broadcast.
17. Trader: confirm the alert banner is gone and the gate marker on the map is green
    again.

## Part 8 — Language and currency check (do this on any surface, any point above)

18. Toggle **MM** on the Trader page.
    **Expect:** headers, milestone labels, and buttons switch to Burmese; the tracking
    number and raw status codes stay as-is (by design — see `README.md`'s "Language
    coverage is a high-visibility subset").
19. Confirm the cargo value still reads `¥10,000` regardless of language — currency
    formatting isn't tied to the language toggle.

---

## What this run is expected to prove, all at once

- RBAC: each role only ever saw its own page, using its own login.
- The Clerk's intake really does reach Driver and Trader with no manual step in between.
- Offline queueing is real (Part 3 — no simulated toggle involved) and idempotent sync
  is real (Part 5 — a manual re-sync doesn't duplicate the event).
- Gate alerts and driver connectivity are independent systems (Part 4).
- The native app and the web PWA are genuinely two clients of one backend, not two demos
  (Part 6).
- Currency and language are independent, orthogonal features (Part 8).

## A gap this script surfaces, worth fixing before it's needed

Walking the full lifecycle end to end exposes something the individual test cases in
`TEST_PLAN.md` don't: **there is no path anywhere in the code that ever sets a
shipment's status to `DELIVERED`.** Checked directly in
`src/app/api/telemetry/route.ts` — `CLEARED` only ever sets `IN_TRANSIT` (and nudges
`routeProgress` up by 0.12), even once progress reaches 100%. `ARRIVED` and
`DELAY_REPORTED` both set `HELD_AT_CHECKPOINT`. None of the four event types reach
`DELIVERED`, so a shipment can advance through Booked → In Transit → Checkpoint
Clearance indefinitely but never completes the milestone stepper on its own.

For a demo, this is invisible — the live script never asks anyone to finish a shipment.
But if a marker or teammate runs a shipment all the way to the end (or asks "so what
happens when it arrives?"), there's currently no answer. The fix is small: add a
`DELIVERED` branch, either triggered by a new driver action ("Delivered / Handed Over")
or by an admin action once `routeProgress` reaches 1 — worth doing before this comes up
live rather than discovering it on stage.
