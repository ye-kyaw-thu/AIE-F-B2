# RLTS-MM Driver — native Android/iOS app

Native Flutter driver client for **B2 Assignment 5**, talking to the same backend as the
web portal (`../rlts-myanmar/src/app/api/*`, currently deployed at
`http://136.85.81.202:3000`). Android is the primary, tested target (an emulator on this
machine); iOS builds from the same code but hasn't been run here — see "iOS" below.

## Why this exists alongside the web driver page

The web app (`../rlts-myanmar/src/app/driver`) already has a working, installable PWA
driver experience with an offline queue, camera capture, and real connectivity
detection. This native app duplicates that functionality rather than replacing it,
because the assignment specifically asked for the driver role to run as an Android/iOS
app with OpenIMIS's Flutter apps as a reference. Two consequences worth knowing:

1. **Both clients hit the same server.** Neither one is more "authoritative" — a
   checkpoint logged from this app appears in the web Trader/Admin views (and vice
   versa) within the API poll interval, because both talk to `/api/telemetry` on the
   same backend.
2. **The offline queue is separate per device.** This app's queue lives in a local
   SQLite database (`sqflite`) on the phone/emulator; the web driver's queue lives in
   IndexedDB in that browser. A shipment being driven by one account should really only
   be checked in from one device at a time — nothing currently prevents both.

## What was actually reused from OpenIMIS

Checked two Flutter apps in `github.com/openimis`: `voucher_enquire_flutter` and
`mobile-self_registration_flutter`. Neither has an offline sync queue — both are
online-only GraphQL clients that assume connectivity. Two patterns were still worth
taking:

- **Connectivity as a stream of a small enum**, from
  `mobile-self_registration_flutter/lib/services/connectivity.dart`
  (`ConnectivityStatus { WiFi, Cellular, Offline }` over the `connectivity` package's
  `onConnectivityChanged`). `lib/services/connectivity_service.dart` here does the same
  thing with the actively-maintained `connectivity_plus` package.
- **Localization as a single `t(lang, key)` lookup**, the same shape as
  `voucher_enquire_flutter`'s generated `AppLocalizations` (backed by `.arb` files there;
  a plain Dart map here in `lib/i18n/translations.dart`, to skip the codegen step this
  close to the deadline — the ARB-based approach is the natural upgrade if this app grows
  past a prototype).

Everything else here — the SQLite offline queue, the idempotent sync engine, the
Sync Now/Sync Ref UI — has no OpenIMIS equivalent to draw from; it mirrors the web
driver's own design (`../rlts-myanmar/src/lib/db/dexie-offline.ts` and
`../rlts-myanmar/src/lib/sync/sync-engine.ts`) instead, field-for-field, so the two
clients behave identically even though one's TypeScript and the other's Dart.

## Running it

```bash
flutter pub get
flutter devices          # confirm an Android emulator or device is attached
flutter run               # or: flutter build apk --debug
```

Demo accounts (same ones the web app uses): `driver` / `driver123` and `driver2` /
`driver123`. The API base URL is hardcoded in `lib/config.dart` — change it if the
backend ever moves off the current GCP VM.

`android/app/src/main/AndroidManifest.xml` sets `usesCleartextTraffic="true"` because the
backend is plain HTTP, not HTTPS — same trade-off the web app's `DEPLOY.md` documents,
made for the same reason (no time to set up a domain + TLS certificate before the
deadline).

## iOS

The project scaffolds an `ios/` target and should build the same Dart code, but this
machine's Xcode/CocoaPods setup wasn't healthy enough to verify a real run here
(`flutter doctor` reported CocoaPods installed but not working). Treat iOS as
untested — Android is the one this was actually built and run against.

## What's simplified vs. the web app (say so if asked)

- **No SLOW_2G auto-detection.** `connectivity_plus` reports connected/disconnected, not
  signal quality, so the "SLOW 2G" state that the web app derives from the Network
  Information API isn't auto-detected here — only reachable via manual override. Real
  GPRS/Edge throttling in the Android emulator will still show as ONLINE on this client.
- **Photo compression is JPEG, not WebP.** Used the pure-Dart `image` package to avoid
  pulling in a native WebP encoder under time pressure; same ~200KB budget as the web
  app's `compressImageToWebP()`, different codec.
- **No language persistence.** The web app remembers your EN/MM choice across visits
  (localStorage); this app resets to English on a fresh launch — fine for a demo, would
  need `shared_preferences` wiring (already a dependency here) to persist.
