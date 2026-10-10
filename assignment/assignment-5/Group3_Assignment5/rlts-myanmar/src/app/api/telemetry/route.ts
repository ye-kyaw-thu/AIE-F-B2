import { NextResponse } from "next/server";
import { mutate, newId } from "@/lib/server/db";
import type { Shipment, TelemetryEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

function makeBatchRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SYNC-${ts}-${rand}`;
}

/**
 * The real sync endpoint the "Sync Now" button hits — both from the web driver page
 * (src/lib/sync/sync-engine.ts) and from the Flutter driver app. Idempotent on
 * eventUuid, same rule as before: a retried submission (dropped connection, tapped
 * "Sync Now" twice) is a safe no-op rather than duplicate history — the same principle
 * borrowed from Open mSupply's changelog de-duplication, just enforced server-side now
 * that there's an actual server. The returned `batchRef` is what's shown to the driver
 * as a "Sync Ref" — a receipt they can quote if a submission is ever disputed.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.eventUuid || !body?.shipmentId || !body?.eventType) {
    return NextResponse.json({ ok: false, error: "eventUuid, shipmentId and eventType are required" }, { status: 400 });
  }

  const serverSyncedAt = new Date().toISOString();
  const batchRef = makeBatchRef();
  let applied = true;

  const state = await mutate((s) => {
    if (s.telemetry.some((t) => t.eventUuid === body.eventUuid)) {
      applied = false; // already applied earlier — idempotent no-op, not an error
      return s;
    }

    const event: TelemetryEvent = {
      id: newId(),
      eventUuid: body.eventUuid,
      shipmentId: body.shipmentId,
      checkpointName: body.checkpointName ?? "Checkpoint",
      eventType: body.eventType,
      notes: body.notes ?? null,
      photoDataUrl: body.photoDataUrl ?? null,
      lat: Number(body.lat) || 0,
      lng: Number(body.lng) || 0,
      clientRecordedAt: body.clientRecordedAt || serverSyncedAt, // never overwritten once set
      serverSyncedAt,
    };

    const telemetry = [...s.telemetry, event];
    const shipments: Shipment[] = s.shipments.map((sh) => {
      if (sh.id !== event.shipmentId) return sh;
      const patch: Partial<Shipment> = { currentLat: event.lat, currentLng: event.lng };
      if (event.eventType === "DELAY_REPORTED") {
        patch.isDelayed = true;
        patch.delayReason = event.notes ?? "Delay reported by driver";
        patch.currentStatus = "HELD_AT_CHECKPOINT";
      } else if (event.eventType === "ARRIVED") {
        patch.currentStatus = "HELD_AT_CHECKPOINT";
      } else if (event.eventType === "CLEARED") {
        patch.currentStatus = "IN_TRANSIT";
        patch.isDelayed = false;
        patch.delayReason = null;
        patch.routeProgress = Math.min(1, sh.routeProgress + 0.12);
      } else if (event.eventType === "REROUTED") {
        patch.currentStatus = "REROUTED";
      } else if (event.eventType === "DELIVERED") {
        // The finalization step: a shipment can otherwise cycle through
        // ARRIVED/CLEARED indefinitely and never actually complete. This is a
        // deliberate driver action (proof of delivery / handover), not something
        // that fires automatically once routeProgress reaches 1 — real delivery
        // is a discrete event, not a progress-bar threshold.
        patch.currentStatus = "DELIVERED";
        patch.routeProgress = 1;
        patch.isDelayed = false;
        patch.delayReason = null;
      }
      return { ...sh, ...patch };
    });

    return { ...s, telemetry, shipments };
  });

  return NextResponse.json({ ok: true, applied, batchRef, serverSyncedAt, state });
}
