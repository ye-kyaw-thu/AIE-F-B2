"use client";

// Store-and-forward sync engine (project_detail.md section 3.2), now syncing over a
// real network call to /api/telemetry instead of a local in-browser store — see
// src/lib/store/appStore.ts for why. `networkState` can come from the driver page's
// manual demo toggle (for forcing a state on cue) or from useRealNetworkState (actual
// device connectivity) — either way, this module doesn't know or care which; it's
// handed a NetworkState and a "should I try to talk to the network right now" answer.

import { v4 as uuidv4 } from "uuid";
import { offlineDB } from "@/lib/db/dexie-offline";
import type { NetworkState, PendingSyncRecord, TelemetryEventType } from "@/lib/types";

export interface QueueCheckpointInput {
  shipmentId: string;
  checkpointName: string;
  eventType: TelemetryEventType;
  notes?: string | null;
  photoDataUrl?: string | null;
  lat: number;
  lng: number;
}

/** Write a driver action to the local queue first, always — instant UI feedback. */
export async function queueCheckpointEvent(input: QueueCheckpointInput): Promise<string> {
  const eventUuid = uuidv4();
  const record: PendingSyncRecord = {
    eventUuid,
    shipmentId: input.shipmentId,
    checkpointName: input.checkpointName,
    eventType: input.eventType,
    notes: input.notes ?? null,
    photoDataUrl: input.photoDataUrl ?? null,
    lat: input.lat,
    lng: input.lng,
    clientRecordedAt: new Date().toISOString(), // the real, offline-safe timestamp
    status: "QUEUED_LOCALLY",
    serverSyncedAt: null,
  };
  await offlineDB.pendingSyncQueue.put(record);
  return eventUuid;
}

export async function queuedCount(): Promise<number> {
  return offlineDB.pendingSyncQueue.where("status").equals("QUEUED_LOCALLY").count();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TelemetryPostResponse {
  ok: boolean;
  applied: boolean;
  batchRef: string;
  serverSyncedAt: string;
}

export interface FlushResult {
  synced: number;
  failed: number;
  /** The most recent sync reference returned by the server — shown to the driver as a receipt. */
  lastSyncRef: string | null;
}

/**
 * Drain the local queue, oldest first (by clientRecordedAt, the order they actually
 * happened), POSTing each to /api/telemetry. The endpoint is idempotent on eventUuid, so
 * re-running this after a partial failure never double-applies an already-synced event.
 * If a request genuinely fails (real network drop, server unreachable), the loop stops
 * and leaves the rest queued rather than silently losing them.
 */
export async function flushQueue(networkState: NetworkState): Promise<FlushResult> {
  if (networkState === "OFFLINE") return { synced: 0, failed: 0, lastSyncRef: null };

  const pending = await offlineDB.pendingSyncQueue
    .where("status")
    .equals("QUEUED_LOCALLY")
    .sortBy("clientRecordedAt");

  let synced = 0;
  let failed = 0;
  let lastSyncRef: string | null = null;

  for (const record of pending) {
    if (networkState === "SLOW_2G") {
      await delay(900); // simulate a slow, one-at-a-time 2G upload for the demo
    }
    try {
      const res = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`sync failed (${res.status})`);
      const body = (await res.json()) as TelemetryPostResponse;
      await offlineDB.pendingSyncQueue.update(record.eventUuid, {
        status: "SYNCED",
        serverSyncedAt: body.serverSyncedAt,
      });
      lastSyncRef = body.batchRef;
      synced += 1;
    } catch {
      failed += 1;
      break; // stop draining on a real failure — leave the rest QUEUED_LOCALLY for the next attempt
    }
  }
  return { synced, failed, lastSyncRef };
}

/**
 * Fallback Structured SMS payload for total blackouts (project_detail.md 3.5), e.g.:
 *   MM-TRK#SH8842#CKPT-KYAUKME#OK#LAT22.52#LNG97.03#T1430
 */
export function buildFallbackSms(record: Pick<PendingSyncRecord, "shipmentId" | "checkpointName" | "eventType" | "lat" | "lng" | "clientRecordedAt">): string {
  const trackingSuffix = record.shipmentId.replace(/\D/g, "").slice(-4) || "0000";
  const checkpointCode = record.checkpointName
    .toUpperCase()
    .replace(/[^A-Z]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  const statusCode = record.eventType === "DELAY_REPORTED" ? "DELAY" : "OK";
  const d = new Date(record.clientRecordedAt);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `MM-TRK#SH${trackingSuffix}#CKPT-${checkpointCode}#${statusCode}#LAT${record.lat.toFixed(2)}#LNG${record.lng.toFixed(2)}#T${hhmm}`;
}
