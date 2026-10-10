# RLTS-MM Test Plan

Covers RBAC, the Data Entry Clerk intake workflow, currency, Sync Now/Sync Ref, and
real-world end-to-end scenarios across **four surfaces**: Admin, Trader and Clerk on a
desktop browser; Driver on either the web PWA (Android emulator's Chrome) or the native
Flutter app in `../rlts_driver_app/`. Test against the live deployment at
`http://136.85.81.202:3000` (see `DEPLOY.md`), or `http://localhost:3000` for a local
`npm run dev`.

For a single continuous walkthrough of one shipment's whole lifecycle across every
surface at once — the one to run before a rehearsal — see
[`E2E_TEST_SCENARIO.md`](E2E_TEST_SCENARIO.md). The sections below are the granular,
single-feature test cases that scenario draws on.

## 0. What changed to make this testable

Before this pass, the "role selector" on `/` was a plain router link — anyone could open
`/admin` directly with no login at all, which fails the assignment's own RBAC
requirement (`README.md` #1), and the driver's "offline" state was a UI button only, not
tied to the device's actual connectivity, so testing it on a real Android emulator
wouldn't have proven anything.

All fixed, plus the backend became real:

- **RBAC is now enforced**, not just implied. `/admin`, `/trader`, `/driver`, `/clerk`
  each require a signed-in session with the matching role
  (`src/components/RequireRole.tsx`); visiting without one, or with the wrong role,
  redirects to `/login`. See §3.
- **The driver's network state is now real**, not simulated-only. `useRealNetworkState`
  (`src/lib/net/useRealNetworkState.ts`) reads `navigator.onLine` and the Network
  Information API, so toggling the Android emulator's actual airplane mode or network
  profile genuinely changes what the app sees. A manual override still exists for
  demo-day timing control, but it's now layered on top of real detection instead of
  being the only source of truth. See §6.
- **The backend is now a real server** (`src/app/api/*`), not a browser-only trick — see
  `README.md` "Backend". This is what makes the Data Entry Clerk's workflow, and the
  native Android driver app, actually possible: a shipment the clerk creates is visible
  to the Trader and Driver on *any* device, not just other tabs of the same browser.

## 1. Test accounts

| Username | Password | Role | Represents |
|---|---|---|---|
| `admin` | `admin123` | `logistics_admin` | Dispatch Admin |
| `clerk` | `clerk123` | `data_entry_clerk` | Data Entry Clerk |
| `trader` | `trader123` | `cargo_trader` | Golden Land Trading Co. |
| `trader2` | `trader123` | `cargo_trader` | Irrawaddy Exports Ltd. (secondary — for data-scoping tests) |
| `driver` | `driver123` | `truck_driver` | U Aung Ko (driving MM-TRK-8842) |
| `driver2` | `driver123` | `truck_driver` | Daw Hla Hla Win (secondary — for data-scoping tests) |

The first four are shown directly on the `/login` screen as quick-login buttons;
`trader2`/`driver2` are reachable via the manual form only, to keep that grid from
getting cluttered. They're demo credentials only (see `src/lib/auth/users.ts`) — not for
anything beyond this prototype.

**Important for multi-role testing in one browser:** the login session is stored in
`sessionStorage`, which is per-tab, while the shared shipment/gate data now lives on the
server and is polled every 2 seconds. That means you can log in as a different role in
each tab of the *same* browser and they won't log each other out, and — unlike before —
you can also open the same URL on an entirely different laptop, tablet, or the native
Android app and see the same live data, with up to a ~2 second lag.

## 2. Data Entry Clerk test cases — creates the data everything else uses

Sign in as `clerk` / `clerk123` first. This is the "simplify the process" workflow: one
intake form, immediately visible everywhere else — do this section before §4/§5/§6 if
you want a second shipment to test with beyond the seeded `MM-TRK-8842`.

| # | Steps | Expected result |
|---|---|---|
| CLK-1 | Fill in: Assign Driver = `Daw Hla Hla Win`, Trader/Customer = `Irrawaddy Exports Ltd.`, Corridor = Eastern (Thailand) — Myawaddy, Cargo Type = "Electronics", Weight = 5, Cargo Value = 10000, Currency = Chinese Yuan (CNY). Leave Tracking # blank. Click **Create Shipment**. | Green confirmation message; form clears. A new shipment appears with an auto-generated tracking number like `MM-TRK-####`. |
| CLK-2 | Sign in as `driver2` / `driver123` (the driver just assigned) in another tab. | The Current Route Card shows the new shipment — Yangon → Myawaddy, Electronics, 5t — within ~2 seconds of creation, no refresh needed beyond the page's own poll. |
| CLK-3 | Sign in as `trader2` / `trader123` in another tab. | The new tracking number appears in Trader's shipment chips; selecting it shows Cargo Value formatted as `¥10,000` (CNY). |
| CLK-4 | Sign in as `trader` / `trader123` instead (the *other* trader account). | Does **not** see the CLK-1 shipment — only `MM-TRK-8842`, which belongs to `trader`, not `trader2`. Confirms data scoping, not just role scoping. |
| CLK-5 | Repeat CLK-1 but explicitly type a Tracking # (e.g. `MM-TRK-7777`). | The shipment is created with that exact tracking number instead of a random one. |
| CLK-6 | Try submitting with Cargo Type left blank. | Browser's native "required field" validation blocks submission — no empty-cargo-type shipment is created. |

## 3. RBAC test cases

| # | Steps | Expected result |
|---|---|---|
| RBAC-1 | Open `/admin` directly in a fresh/incognito tab, not logged in. | Briefly shows "Checking access for Admin / Dispatcher…", then redirects to `/login?required=logistics_admin`, which shows a banner: "That page requires the Admin / Dispatcher role." |
| RBAC-2 | On `/login`, sign in as `trader` / `trader123`, then manually navigate the URL bar to `/admin`. | Redirected back to `/login` — a Trader session cannot view the Admin console, even by typing the URL directly. |
| RBAC-3 | Sign in as `admin` / `admin123`. | Redirected straight to `/admin`; page loads normally; the header shows "Dispatch Admin · Admin / Dispatcher" with a Log out button. |
| RBAC-4 | On `/login`, enter a wrong password for any username. | Inline error: "Incorrect username or password." Form does not navigate anywhere. |
| RBAC-5 | While signed in as any role, click **Log out** in the header. | Returns to `/login`; the same tab can no longer reach its former role's page without signing in again. |
| RBAC-6 | Sign in as `admin` in Tab A. Open a new tab (Tab B, same browser) and go straight to `/trader`. | Tab B is *not* auto-logged-in as admin (sessionStorage is per-tab) — it redirects to `/login`, correctly asking for the trader role rather than reusing Tab A's session. |
| RBAC-7 | From the landing page `/`, click the "Trader" card. | Goes to `/login?as=trader` with the username field pre-filled to `trader` (convenience only — password still required, no banner shown since this wasn't a blocked-access redirect). |
| RBAC-8 | View page source (`curl` or "View Page Source", not DevTools-rendered DOM) of `/admin` without logging in. | The server-rendered HTML contains only "Checking access…", never the gate list, shipment manifest, or broadcast form — confirms the guard, not just a client-side hide/show. |
| RBAC-9 | Sign in as `driver` / `driver123`, then navigate to `/clerk`. | Redirected to `/login?required=data_entry_clerk` — a Driver account cannot create shipments. |

## 4. Admin test cases (web browser)

Sign in as `admin` / `admin123` first (RBAC-3).

| # | Steps | Expected result |
|---|---|---|
| ADM-1 | On the Fleet Live Map, note the truck marker's position. | Marker sits along the Yangon→Muse route at the shipment's current `routeProgress`. |
| ADM-2 | In Global Route & Gate Control Center, click `CLOSED` on Muse Border Gate. | Muse's status badge turns red/`CLOSED` immediately; the map's Muse marker also turns red. |
| ADM-3 | Type a closure reason (e.g. "Security incident") before clicking a status button, then click `CONGESTED`. | The gate's card shows "Last note: Security incident" underneath. |
| ADM-4 | Fill in Broadcast Alert (title, message, pick Muse gate, severity `CRITICAL`) and click **Send Broadcast**. | New entry appears in the broadcast list below, marked `CRITICAL`; see TRD-4 for the Trader-side effect. |
| ADM-5 | Click **dismiss** on an active broadcast. | It fades and shows without a dismiss button (no longer active). |
| ADM-6 | Click **Reset demo state**. | Gates return to `OPEN`, the seeded shipment resets to its starting position, telemetry/broadcasts clear — **note:** this also removes any shipments created via the Data Entry Clerk (§2), since it re-seeds the whole server-side store. Useful between test runs or demo rehearsals, but re-run §2 afterward if you need those shipments back. |
| ADM-7 | With a Clerk-created shipment (§2) present, check the Shipment Manifest table. | Shows both shipments, each with its own Trader and Cargo Value columns — confirms the manifest isn't hardcoded to the single seeded shipment. |
| ADM-8 | Click the pencil icon on a shipment row, change Cargo Type and Cargo Value, click **Save changes**. | Modal closes; the manifest row updates within ~2 seconds; switch to that shipment's Trader/Driver view and confirm they see the corrected values too — this is the fix for "I entered wrong data" without needing a full Reset. |
| ADM-9 | Click the trash icon on a shipment row. | Browser confirm dialog naming the tracking number; confirming removes it from the manifest and from Trader/Driver views within the poll interval; cancelling leaves it untouched. |
| ADM-10 | With two or more shipments present, note the KPI cards above the map (Active Shipments, Delayed, Cargo Value In Transit, Gates Closed/Restricted, Active Critical Alerts). | Counts match the manifest table exactly — e.g. Active Shipments equals the number of non-`DELIVERED` rows, Cargo Value In Transit is the sum of all active shipments' values converted to USD. |
| ADM-11 | Click a different tracking-number chip above the map, then click a different row in the manifest table below. | The map's route line and truck marker update to match whichever shipment you selected either way; the manifest row for the currently focused shipment gets a light blue highlight. |
| TRD-KPI | On Trader, with more than one shipment belonging to a different trader account also present in the system. | Trader's three KPI cards (Active Shipments, Delayed, Cargo Value In Transit) only ever count *this* trader's own shipments — confirms scoping, not a fleet-wide number leaking into the Trader view. |

## 5. Trader test cases (web browser)

Sign in as `trader` / `trader123`. Use a **second browser tab**, still signed in as
admin, to drive the cross-role checks.

| # | Steps | Expected result |
|---|---|---|
| TRD-1 | Type `8842` into the tracking search box. | `MM-TRK-8842` appears as a filter chip; selecting it loads that shipment. |
| TRD-2 | Observe the Milestone Stepper. | Matches the shipment's `currentStatus` (e.g. "In Transit" highlighted, "Booked/Depot Pickup" checked off). |
| TRD-3 | Observe the Live Interactive Map. | Same truck position and gate colors as the Admin's Fleet Live Map — both read the same shared server state. |
| TRD-3b | Note the Cargo Value line under the shipment header. | Shows `$42,000` (USD) for the seeded shipment, formatted via `Intl.NumberFormat`, not a raw number. |
| TRD-4 | In the Admin tab, close the Muse gate and send a `CRITICAL` broadcast tied to Muse (ADM-2, ADM-4). Switch back to the Trader tab and wait a couple of seconds. | Within a couple of seconds (the 2-second state poll, see `README.md` "Backend"), a red pulsing alert banner appears with a two-tone chime sound, showing the broadcast title/message. This is no longer instant the way the old BroadcastChannel version was — a short, visible delay is expected and correct. |
| TRD-5 | Click **Dismiss** on that alert banner. | Banner disappears from the Trader view; re-opening the Admin tab shows the broadcast now inactive there too (shared state). |
| TRD-6 | After a driver checkpoint event has synced (see §6), check the Document & Inspection Viewer. | Shows the checkpoint name, event type, notes, photo thumbnail (if one was attached), and both "Recorded" and "Synced" timestamps. |

## 6. Driver test cases — web PWA on an Android emulator

Covers the browser-based driver page. For the separate native app, see §6b.

### 6.1 Emulator setup

1. In Android Studio, open **Device Manager** and launch an existing AVD, or create one
   (any recent Pixel profile + a system image with Google APIs/Play works; the app just
   needs a modern Chrome).
2. Once booted, open **Chrome** inside the emulator.
3. Navigate to `http://136.85.81.202:3000` (the emulator's virtual network reaches the
   public internet through your host machine by default — no port forwarding needed). If
   testing a local dev server instead of the deployed VM, use `http://10.0.2.2:3000`,
   which is the emulator's special alias for the host machine's `localhost`.
4. Sign in with `driver` / `driver123` (or tap the Driver quick-login card).

### 6.2 Enabling camera and network controls

- Click the **`...` (Extended Controls)** button on the emulator's side toolbar.
- **Camera tab:** set the back camera to `VirtualScene` or `Webcam0` (passes your
  laptop's webcam through) so the in-app "Capture waybill / inspection photo" control has
  something real to capture, rather than failing silently.
- **Cellular tab:** this is what makes offline testing *real* rather than simulated —
  see 5.4.

### 6.3 Functional test cases

| # | Steps | Expected result |
|---|---|---|
| DRV-1 | After login, check the Current Route Card. | Shows `MM-TRK-8842`, origin→destination, cargo type, Cargo Value (formatted with currency), and a "Next: [checkpoint] — N km" line. |
| DRV-2 | Tap **Capture waybill / inspection photo**, take/select a photo. | Label changes to "Photo attached ✓"; no crash even on a slow emulator. |
| DRV-3 | Type a note, then tap **Arrived at Checkpoint**. | "Arrived at Checkpoint queued at [time]" appears below the buttons; the Local Queue list at the bottom shows the new entry with a short `Ref:` code (first 8 characters of its event UUID). |
| DRV-4 | With the device online, immediately check the Local Queue entry's status. | Status flips from `QUEUED_LOCALLY` to `SYNCED` within roughly a second (auto-flush on online). The `Sync Ref:` line above the queue updates to a server-issued reference like `SYNC-XYZ123-AB12`. |
| DRV-4b | Tap the **Sync Now** button directly (with nothing new queued). | No error; if there's nothing pending it's a harmless no-op, and the button is disabled entirely while the device is OFFLINE. |
| DRV-5 | Switch to the Trader tab (desktop browser, TRD-6). | The new checkpoint event now appears in the Document & Inspection Viewer, including the attached photo. |
| DRV-6 | Tap **Inspection Passed**. | Trader's Milestone Stepper (TRD-2) advances; shipment's `isDelayed` clears if it was previously set. |
| DRV-7 | Tap **Report Delay / Danger** with a note like "Landslide blocking pass". | Trader dashboard shows `HELD_AT_CHECKPOINT` and the delay reason from ADM's shipment manifest table (`s.delayReason`). |

### 6.4 Real offline / blackout test cases (the point of the assignment)

| # | Steps | Expected result |
|---|---|---|
| DRV-8 | Extended Controls → Cellular → toggle the emulator to **Airplane mode** (or set Data status to "Denied"). | Within the app, "Network Status" panel's "Device reports:" value flips to `OFFLINE` on its own — **no button was tapped**. This proves detection is real, via `navigator.onLine`, not just the demo toggle. |
| DRV-9 | While in that real offline state, tap **Arrived at Checkpoint** two or three times with different notes. | Each queues successfully with instant UI feedback (README/`project_detail.md` §3.1's "Instant UI feedback, zero latency" requirement) — no spinner, no error, no attempted network call. Local Queue shows all as `QUEUED_LOCALLY`. |
| DRV-10 | Still offline, scroll to the red "Extreme blackout fallback" panel and tap **Generate structured SMS payload**. | Produces a string like `MM-TRK#SH8842#CKPT-KYAUKME#OK#LAT22.53#LNG97.03#T1430` — matches the format specified in `project_detail.md` §3.5. |
| DRV-11 | Turn Airplane mode back off in the emulator (real reconnect, not the in-app toggle). | "Device reports:" flips back to `ONLINE` automatically; within moments all `QUEUED_LOCALLY` entries flip to `SYNCED`, oldest first. |
| DRV-12 | Switch to the Trader tab and check the timeline order for the events queued in DRV-9. | Events appear **in the order they actually happened** (`clientRecordedAt`), not in a burst at the reconnect moment — this is the mSupply-derived append-only/idempotent design (`README.md` "Architecture decisions borrowed from Open mSupply") actually working, not just claimed. |
| DRV-13 | Extended Controls → Cellular → Network type → **GPRS** or **Edge**, with data still "on". | "Device reports:" flips to `SLOW_2G` (via the Network Information API's `effectiveType`), without touching the manual toggle. |
| DRV-14 | Queue a checkpoint event under simulated GPRS/Edge. | Sync still completes, but visibly slower (roughly ~1s, per the `SLOW_2G` delay in `sync-engine.ts`) rather than instant — demonstrates degraded-but-working sync, not a hard failure. |
| DRV-15 | While the real device network is `ONLINE`, tap the manual **OFFLINE BLACKOUT** button in the app's Network Status panel. | A note appears: "Override active — click to go back to the device's real network state (ONLINE)." The app behaves as offline even though the device itself is online — this is the deliberate demo-day override, for forcing a blackout on cue during the live presentation regardless of venue wifi. The **Sync Now** button also greys out while this override is active. |
| DRV-16 | Click that override note to clear it. | Returns to following the real device state. |
| DRV-17 | Queue two checkpoint events while OFFLINE (real or overridden), then tap **Sync Now** once reconnected instead of waiting for auto-flush. | Both drain in one go; the `Sync Ref:` line shows the ref from the *last* one synced in that batch. |

## 6b. Driver test cases — native Android app (`rlts_driver_app`)

Same underlying behavior as §6, different client. See `../rlts_driver_app/README.md`
for setup. Run this against the **same emulator** used for §6, or a second one, to see
both driver clients talking to the same backend simultaneously.

| # | Steps | Expected result |
|---|---|---|
| FLT-1 | `flutter run -d emulator-5554` (or `flutter install` a built APK), sign in as `driver2` / `driver123`. | App launches to the Sign In screen, then to the driver home screen after login — no crash, no white screen. |
| FLT-2 | Pull-to-refresh on the home screen. | Re-fetches the assigned shipment and the local queue; no visible error if the shipment list is empty (shows "No shipment assigned to this driver yet."). |
| FLT-3 | Tap **Arrived at Checkpoint** with a note and a camera-captured photo. | Instantly shows in the Local Queue as `QUEUED_LOCALLY`, flips to `SYNCED` within moments if online — mirrors DRV-3/DRV-4 on the web client. |
| FLT-4 | Open the web Trader view for that same shipment (`trader2` / `trader123`). | The checkpoint logged from the **native app** appears in the web Document & Inspection Viewer — proof the two clients share one backend, not two separate demo states. |
| FLT-5 | In Extended Controls → Cellular, set Data status to **Denied** (or toggle Airplane Mode in the emulator's quick settings). | The app's network segmented control's "AUTO" selection reflects OFFLINE; queued actions still work with instant feedback, same as DRV-9. |
| FLT-6 | Re-enable data. | Queued items sync automatically; `Sync Ref` updates. Tap **Sync Now** manually too, to confirm the explicit button path also works, not just the automatic one. |
| FLT-7 | Switch the language segmented control to MM in both the login screen and the home screen's app bar. | UI labels switch to Burmese for the translated subset (see `rlts_driver_app/README.md` — note the language choice does **not** persist across an app restart, a known simplification). |

## 7. Cross-role end-to-end scenarios

These mirror the choreographed script in `project_detail.md` §7, written as
pass/fail-checkable steps across all four roles (Admin, Trader and Clerk on desktop
tabs, Driver on either the Android emulator's browser or the native app):

| # | Steps | Expected result |
|---|---|---|
| E2E-1 | Admin, Trader, Driver all signed in (Clerk optional for this run). Admin: leave gates OPEN. Trader: confirm no alert banner. Driver: confirm `IN_TRANSIT`/no delay shown anywhere. | Clean baseline state across all views — confirms `resetDemo` (ADM-6) produces a consistent starting point for a rehearsal. |
| E2E-2 | Driver: put the emulator in real Airplane mode (DRV-8). Driver: tap "Arrived at Checkpoint" with a photo attached. | Driver shows `QUEUED_LOCALLY`; Trader's Document Viewer shows **nothing new yet** (correctly — it hasn't synced). |
| E2E-3 | Admin: close the Muse gate with a reason, send a `CRITICAL` broadcast (ADM-2, ADM-4). | Trader sees the red alert + chime within the same second (TRD-4), independent of the driver's current connectivity — proves gate alerts don't depend on the driver's sync state. |
| E2E-4 | Driver: turn Airplane mode back off (DRV-11). | Driver's queued event syncs; Trader's timeline updates with the correct original timestamp (DRV-12), while the gate-closure alert from E2E-3 is still showing, both features coexisting correctly. |
| E2E-5 | Admin: reroute or clear the gate back to `OPEN`; Driver: tap "Inspection Passed". | Trader's milestone stepper advances and the alert can be dismissed — full lifecycle closes out cleanly. |

## 8. Known limitations to flag if a reviewer/marker probes further

- **Demo auth only.** `src/lib/auth/users.ts` is a hardcoded, plaintext credential list
  with no hashing, no rate-limiting on login attempts, validated both client-side (web)
  and via `/api/auth/login` (server, used by the Flutter app) — appropriate for a
  prototype demo, not for anything handling real cargo/personal data. Real auth would be
  Supabase Auth against the roles already defined in `supabase/schema.sql`.
- **The backend is a JSON file, not a database.** Fine for a handful of concurrent demo
  users; not a real persistence guarantee. See `README.md` "Backend".
- **~2 second latency between an action and other devices seeing it,** because the
  shared state now polls the server rather than pushing instantly over
  `BroadcastChannel`. This is a deliberate trade for real multi-device sharing — call it
  out if a marker asks why the Trader's alert doesn't appear the instant Admin sends it.
- **Currency conversion is static, not live**, and **Myanmar translations are
  AI-generated and unreviewed** — both noted in `README.md`'s "Deliberate
  simplifications".
- **The native Flutter app doesn't auto-detect SLOW_2G** the way the web app does via the
  Network Information API — see `rlts_driver_app/README.md`.
- **`ADM-6` (Reset demo state) deletes Clerk-created shipments too** — it re-seeds the
  entire server store, not just the original demo shipment. Re-run §2 after a reset if
  you need a second shipment for testing.
