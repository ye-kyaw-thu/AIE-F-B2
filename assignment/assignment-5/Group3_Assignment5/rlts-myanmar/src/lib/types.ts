// Shared domain types for RLTS-MM.
// These mirror the Postgres/Supabase schema in supabase/schema.sql (itself taken from
// project_detail.md section 5) so the "local" demo backend and the "supabase" backend
// can share the exact same shapes and be swapped without touching UI code.

export type Role = "logistics_admin" | "cargo_trader" | "truck_driver" | "data_entry_clerk";

export type Currency = "USD" | "CNY" | "MMK";

export type GateStatus =
  | "OPEN"
  | "CONGESTED"
  | "CLOSED"
  | "ARMED_INSPECTION"
  | "FLOODING"
  | "EMERGENCY_HALT";

export interface BorderGate {
  id: string;
  code: string; // e.g. 'GATE_MUSE_105'
  name: string;
  corridor: string; // 'Northern (China)' | 'Eastern (Thailand)'
  status: GateStatus;
  closureReason: string | null;
  lat: number;
  lng: number;
  updatedAt: string; // ISO timestamp
  updatedBy: string | null;
}

export type ShipmentStatus =
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "HELD_AT_CHECKPOINT"
  | "CUSTOMS_PROCESSING"
  | "DELIVERED"
  | "REROUTED";

export interface Shipment {
  id: string;
  trackingNumber: string; // 'MM-TRK-8842'
  traderName: string;
  /** Links to a DEMO_USERS username with role cargo_trader — scopes what a trader sees. */
  traderUsername: string | null;
  driverName: string;
  /** Links to a DEMO_USERS username with role truck_driver — scopes what a driver sees. */
  driverUsername: string | null;
  cargoType: string;
  cargoWeightTons: number;
  cargoValue: number;
  cargoValueCurrency: Currency;
  originName: string;
  destinationName: string;
  targetGateId: string;
  currentStatus: ShipmentStatus;
  currentLat: number;
  currentLng: number;
  /** 0..1 progress along the route polyline — drives the simulated GPS marker. */
  routeProgress: number;
  isDelayed: boolean;
  delayReason: string | null;
  createdAt: string;
  estimatedArrival: string;
  /** username of the data_entry_clerk who created this shipment record, if any. */
  createdBy: string | null;
}

export type TelemetryEventType =
  | "ARRIVED"
  | "CLEARED"
  | "DELAY_REPORTED"
  | "GPS_PING"
  | "REROUTED"
  | "DELIVERED";

/**
 * Append-only checkpoint/telemetry log entry.
 *
 * Modeled directly on Open mSupply's sync changelog: records are never edited or
 * overwritten, only appended. `eventUuid` is a client-generated idempotency key
 * (mirrors mSupply's per-record id + de-duplication-at-integration rule) so retried
 * batch syncs over an unstable 2G link never create duplicate history.
 *
 * `clientRecordedAt` vs `serverSyncedAt` mirrors mSupply's separation of "when the
 * mutation actually happened" from "when it reached the central changelog" — the
 * trader-facing timeline is always sorted by `clientRecordedAt`, never by arrival
 * order, so a truck emerging from a 6-hour blackout doesn't show a false event spike.
 */
export interface TelemetryEvent {
  id: string;
  eventUuid: string;
  shipmentId: string;
  checkpointName: string;
  eventType: TelemetryEventType;
  notes: string | null;
  photoDataUrl: string | null;
  lat: number;
  lng: number;
  clientRecordedAt: string;
  serverSyncedAt: string;
}

export type BroadcastSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface EmergencyBroadcast {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  gateId: string | null;
  routeAffected: string | null;
  isActive: boolean;
  createdAt: string;
}

export type NetworkState = "ONLINE" | "SLOW_2G" | "OFFLINE";

export type SyncQueueStatus = "QUEUED_LOCALLY" | "SYNCING" | "SYNCED";

/** Row shape for the driver-side Dexie (IndexedDB) pending_sync_queue table. */
export interface PendingSyncRecord {
  eventUuid: string; // primary key — also the idempotency key on the server side
  shipmentId: string;
  checkpointName: string;
  eventType: TelemetryEventType;
  notes: string | null;
  photoDataUrl: string | null;
  lat: number;
  lng: number;
  clientRecordedAt: string;
  status: SyncQueueStatus;
  serverSyncedAt: string | null;
}

export interface CloudState {
  rev: number; // monotonically increasing revision, used to detect stale cross-tab writes
  gates: BorderGate[];
  shipments: Shipment[];
  telemetry: TelemetryEvent[];
  broadcasts: EmergencyBroadcast[];
}
