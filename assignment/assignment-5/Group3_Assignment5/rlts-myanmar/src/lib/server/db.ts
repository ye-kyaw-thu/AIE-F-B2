// Server-side shared state for RLTS-MM.
//
// This is the real backend that makes "synced to driver and trader and web portal"
// actually true across process/device boundaries — the earlier `local` backend
// (localStorage + BroadcastChannel, still in src/lib/store/appStore.ts's git history)
// only worked within one browser, which breaks the moment a native Flutter driver app
// enters the picture: a separate OS process has no access to another app's browser
// storage. This module is a plain JSON-file-backed store behind a write queue —
// deliberately not a full database, since standing up managed Postgres wasn't worth the
// time against the deadline. It's swapped for supabase/schema.sql + Supabase Postgres
// the same way the old local backend was meant to be: same shape, different transport.
//
// IMPORTANT for deployment: the data file lives OUTSIDE the app's source directory by
// default in production (see DB_FILE below) so that redeploying the app (which replaces
// the source tree) does not wipe demo data. Set RLTS_DB_PATH to override the location.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { BorderGate, CloudState, Shipment } from "@/lib/types";
import { NORTHERN_CORRIDOR, positionAlongRoute } from "@/lib/geo/myanmar-routes";

const DB_FILE = process.env.RLTS_DB_PATH || path.join(process.cwd(), "data", "db.json");

function seedState(): CloudState {
  const now = new Date().toISOString();
  // Seed the shipment at routeProgress 0.33 using the same road-following geometry the
  // UI uses, rather than a hardcoded array index — see the comment on `currentLat` below.
  const seedPos = positionAlongRoute(NORTHERN_CORRIDOR, 0.33);
  const gates: BorderGate[] = [
    {
      id: "gate-muse",
      code: "GATE_MUSE_105",
      name: "Muse Border Gate (China)",
      corridor: "Northern (China)",
      status: "OPEN",
      closureReason: null,
      lat: 23.9833,
      lng: 97.9167,
      updatedAt: now,
      updatedBy: null,
    },
    {
      id: "gate-myawaddy",
      code: "GATE_MYAWADDY_FRIENDSHIP",
      name: "Myawaddy Border Gate (Thailand)",
      corridor: "Eastern (Thailand)",
      status: "OPEN",
      closureReason: null,
      lat: 16.6833,
      lng: 98.5333,
      updatedAt: now,
      updatedBy: null,
    },
    {
      id: "gate-chinshwehaw",
      code: "GATE_CHINSHWEHAW",
      name: "Chinshwehaw Gate (China)",
      corridor: "Northern (China)",
      status: "OPEN",
      closureReason: null,
      lat: 23.35,
      lng: 98.75,
      updatedAt: now,
      updatedBy: null,
    },
  ];

  const shipments: Shipment[] = [
    {
      id: "ship-8842",
      trackingNumber: "MM-TRK-8842",
      traderName: "Golden Land Trading Co.",
      traderUsername: "trader",
      driverName: "U Aung Ko",
      driverUsername: "driver",
      cargoType: "Agricultural Produce",
      cargoWeightTons: 18.5,
      cargoValue: 42000,
      cargoValueCurrency: "USD",
      originName: NORTHERN_CORRIDOR[0].name ?? "Yangon",
      destinationName: "Muse 105-Mile Border Trade Zone",
      targetGateId: "gate-muse",
      currentStatus: "IN_TRANSIT",
      currentLat: seedPos.lat,
      currentLng: seedPos.lng,
      routeProgress: 0.33,
      isDelayed: false,
      delayReason: null,
      createdAt: now,
      estimatedArrival: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
      createdBy: null,
    },
  ];

  return { rev: 0, gates, shipments, telemetry: [], broadcasts: [] };
}

function ensureFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedState(), null, 2));
  }
}

export function readState(): CloudState {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  try {
    return JSON.parse(raw) as CloudState;
  } catch {
    const seeded = seedState();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

// Serializes all writes through one promise chain so concurrent requests (e.g. the
// Flutter app and a web tab both syncing at once) can't interleave a read-modify-write
// and lose an update — the Node-single-process equivalent of a row lock.
let writeChain: Promise<CloudState> = Promise.resolve(readState());

export function mutate(fn: (state: CloudState) => CloudState): Promise<CloudState> {
  writeChain = writeChain.then(() => {
    const current = readState();
    const next = { ...fn(current), rev: current.rev + 1 };
    fs.writeFileSync(DB_FILE, JSON.stringify(next, null, 2));
    return next;
  });
  return writeChain;
}

export function resetState(): Promise<CloudState> {
  return mutate(() => ({ ...seedState(), rev: 0 }));
}

export function newId(): string {
  return crypto.randomUUID();
}
