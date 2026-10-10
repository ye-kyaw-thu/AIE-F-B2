# Deployment — GCP

**Live demo URL:** `http://136.85.81.202:3000`

## What's running where

- **GCP project:** `openimis-server-test-508614` (the team's existing trial project — it
  also runs `openimis-pilot`, an unrelated OpenIMIS instance; the two are fully isolated,
  see below).
- **VM:** `rlts-mm-demo`, zone `asia-southeast1-b`, `e2-small` (2 vCPU / 2GB), Ubuntu
  22.04. Created specifically for this prototype — separate from `openimis-pilot`.
- **Firewall:** `allow-rlts-mm-web` allows inbound `tcp:3000` from anywhere, but only for
  instances tagged `rlts-mm-web` (only this VM has that tag). `openimis-pilot`'s own
  firewall rule (`allow-openimis-web`, ports 80/443/8001) is untouched.
- **Process manager:** `pm2`, running `npm run start` (Next.js production server) on
  port 3000, `pm2 save` + `pm2 startup systemd` configured so it survives a VM reboot.
- App files live at `~/app/rlts-myanmar` on the VM (deployed from a tarball, not git —
  see redeploy steps below).
- **Data file:** `~/rlts-data/db.json` — deliberately **outside** `~/app/rlts-myanmar`,
  set via the `RLTS_DB_PATH` env var pm2 was started with. This is what makes the
  backend real state (see `README.md` "Backend"): every redeploy below replaces
  `~/app/rlts-myanmar` entirely, but never touches `~/rlts-data/`, so demo data survives
  a redeploy instead of resetting every time.

## Redeploying after code changes

From your machine, with the `gcloud` CLI installed and authenticated
(`gcloud auth login`, then `gcloud config set project openimis-server-test-508614`):

```bash
cd B2_Assignment5
tar --exclude='rlts-myanmar/node_modules' --exclude='rlts-myanmar/.next' \
    --exclude='rlts-myanmar/data' \
    -czf /tmp/rlts-myanmar.tar.gz rlts-myanmar

gcloud compute scp /tmp/rlts-myanmar.tar.gz rlts-mm-demo:/tmp/rlts-myanmar.tar.gz \
    --zone=asia-southeast1-b

gcloud compute ssh rlts-mm-demo --zone=asia-southeast1-b --command='
  rm -rf ~/app/rlts-myanmar
  mkdir -p ~/app ~/rlts-data
  tar -xzf /tmp/rlts-myanmar.tar.gz -C ~/app
  cd ~/app/rlts-myanmar
  npm install
  npm run build
  pm2 restart rlts-mm
'
```

`pm2 restart` reuses the env vars the process was originally started with (including
`RLTS_DB_PATH`), so a plain restart is enough for ordinary code changes. Only re-run the
full `pm2 delete` + `RLTS_DB_PATH=... PORT=3000 HOSTNAME=0.0.0.0 pm2 start npm --name
rlts-mm -- run start` + `pm2 save` sequence if you need to change an env var itself.

If you'd rather work directly on the VM: `gcloud compute ssh rlts-mm-demo
--zone=asia-southeast1-b`, edit files under `~/app/rlts-myanmar` with `nano`/`vim`, then
run the same `npm run build && pm2 restart rlts-mm` from inside `~/app/rlts-myanmar`.

Useful pm2 commands on the VM: `pm2 status`, `pm2 logs rlts-mm`, `pm2 restart rlts-mm`.

**The native Flutter driver app (`../rlts_driver_app/`) is not deployed here** — it's a
separate distributable (an APK, or `flutter run` against a device/emulator), not a web
process. It already points at this VM's `/api/*` endpoints via
`rlts_driver_app/lib/config.dart`, so nothing on the VM changes for it — only the app
itself needs rebuilding/reinstalling when its own code changes.

## Cost / cleanup

`e2-small` is a low-cost instance but it does bill continuously while running. **After
the 20 Sept presentation**, either:

```bash
gcloud compute instances delete rlts-mm-demo --zone=asia-southeast1-b
gcloud compute firewall-rules delete allow-rlts-mm-web
```

or just stop it if you might want it again soon (no compute charges while stopped, disk
storage still bills a small amount):

```bash
gcloud compute instances stop rlts-mm-demo --zone=asia-southeast1-b
```

## Not done (acceptable for a live IP:port demo, revisit if this becomes long-lived)

- **No HTTPS / no domain** — serving plain `http://` on the VM's IP. Fine for a
  projector demo; browsers will show "not secure," which is expected and not a bug.
- **No reverse proxy (nginx)** — Next.js's own server is exposed directly on 3000.
  Fine for a single-instance demo; add nginx + a domain if this needs to look
  production-grade later.
- **Deployed from a tarball, not git** — there's no CI/CD and no git repo on the VM
  itself. Fine for a 3-day prototype; if the team wants multiple people deploying
  independently, push this repo to GitHub and `git pull` on the VM instead of
  scp'ing tarballs.
- **Backend is a JSON file on the VM's disk, not a database** (`src/lib/server/db.ts`) —
  resolved the earlier browser-only limitation (state is now genuinely shared across
  every visitor's device, including the native Android app), but it's still not a real
  persistence/concurrency guarantee at any real scale. `src/lib/store/supabaseAdapter.ts`
  + `supabase/schema.sql` are the documented upgrade path if this needs to survive past
  the demo.
