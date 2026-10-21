"use client";

// Real-backend reference implementation for NEXT_PUBLIC_BACKEND_MODE=supabase.
//
// Not wired into the pages by default — the Admin/Trader/Driver screens talk to
// `useAppStore` (src/lib/store/appStore.ts), the zero-config local demo backend. This
// file exists so the "Supabase/Firebase" requirement in README.md is backed by real,
// runnable code once a team member creates a Supabase project, runs
// supabase/schema.sql against it, and fills in .env.local. Swapping app code from
// appStore to this adapter is a small, mechanical change since both expose the same
// shape of mutations (toggleGate, createBroadcast, applyTelemetryEvent, ...).
//
// Two things carried over deliberately from Open mSupply's sync design:
//   - applyTelemetryEvent calls the `apply_telemetry_event` Postgres function (see
//     schema.sql), which does `ON CONFLICT (event_uuid) DO NOTHING` — the same
//     idempotency guarantee as mSupply's changelog de-duplication, so a driver's
//     retried batch sync over 2G can't create duplicate checkpoint history.
//   - Realtime subscriptions push straight into the same store shape the local
//     backend uses, so UI components never need to know which backend is live.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BorderGate, EmergencyBroadcast, GateStatus, Shipment, TelemetryEvent } from "@/lib/types";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
        "Copy .env.local.example to .env.local, fill them in, and set NEXT_PUBLIC_BACKEND_MODE=supabase."
    );
  }
  client = createClient(url, key);
  return client;
}

function mapGateRow(row: any): BorderGate {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    corridor: row.corridor,
    status: row.status,
    closureReason: row.closure_reason,
    lat: row.coordinates_lat,
    lng: row.coordinates_lng,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapShipmentRow(row: any): Shipment {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    traderName: row.trader_name ?? "",
    traderUsername: row.trader_username ?? null,
    driverName: row.driver_name ?? "",
    driverUsername: row.driver_username ?? null,
    cargoType: row.cargo_type,
    cargoWeightTons: Number(row.cargo_weight_tons),
    cargoValue: Number(row.cargo_value ?? 0),
    cargoValueCurrency: row.cargo_value_currency ?? "USD",
    originName: row.origin_name,
    destinationName: row.destination_name,
    targetGateId: row.target_gate_id,
    currentStatus: row.current_status,
    currentLat: row.current_lat,
    currentLng: row.current_lng,
    routeProgress: Number(row.route_progress),
    isDelayed: row.is_delayed,
    delayReason: row.delay_reason,
    createdAt: row.created_at,
    estimatedArrival: row.estimated_arrival,
    createdBy: row.created_by ?? null,
  };
}

export async function fetchGates(): Promise<BorderGate[]> {
  const { data, error } = await getSupabaseClient().from("border_gates").select("*");
  if (error) throw error;
  return (data ?? []).map(mapGateRow);
}

export async function fetchShipments(): Promise<Shipment[]> {
  const { data, error } = await getSupabaseClient().from("shipments").select("*");
  if (error) throw error;
  return (data ?? []).map(mapShipmentRow);
}

export async function toggleGate(gateId: string, status: GateStatus, reason: string | null, updatedBy: string) {
  const { error } = await getSupabaseClient()
    .from("border_gates")
    .update({ status, closure_reason: reason, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq("id", gateId);
  if (error) throw error;
}

export async function createBroadcast(b: Pick<EmergencyBroadcast, "title" | "message" | "severity" | "gateId" | "routeAffected">) {
  const { error } = await getSupabaseClient().from("emergency_broadcasts").insert({
    title: b.title,
    message: b.message,
    severity: b.severity,
    gate_id: b.gateId,
    route_affected: b.routeAffected,
  });
  if (error) throw error;
}

/** Idempotent apply via the apply_telemetry_event() RPC — see supabase/schema.sql. */
export async function applyTelemetryEvent(e: Omit<TelemetryEvent, "id" | "serverSyncedAt">) {
  const { error } = await getSupabaseClient().rpc("apply_telemetry_event", {
    p_event_uuid: e.eventUuid,
    p_shipment_id: e.shipmentId,
    p_checkpoint_name: e.checkpointName,
    p_event_type: e.eventType,
    p_notes: e.notes,
    p_photo_url: e.photoDataUrl,
    p_lat: e.lat,
    p_lng: e.lng,
    p_client_recorded_at: e.clientRecordedAt,
  });
  if (error) throw error;
}

/** Subscribe to gate status changes — this is the "Supabase Realtime channel on border_gates" from project_detail.md section 8. */
export function subscribeToGateChanges(onChange: (gate: BorderGate) => void) {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel("border_gates_changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "border_gates" }, (payload) => {
      onChange(mapGateRow(payload.new));
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
