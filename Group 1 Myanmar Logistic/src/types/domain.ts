export const SHIPMENT_STATUSES = [
  "requested", "approved", "picked_up", "in_transit",
  "arrived_at_checkpoint", "customs", "delivered",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export type GateStatus = "open" | "delayed" | "closed";
export type UserRole = "admin" | "trader" | "driver";
export type SyncStatus = "pending" | "synced";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  arrived_at_checkpoint: "Arrived at Checkpoint",
  customs: "Customs",
  delivered: "Delivered",
};

// View models for static fixtures. Generate database types in Phase 2.
export interface ShipmentPreview {
  id: string;
  shipmentNumber: string;
  origin: string;
  destination: string;
  cargo: string;
  quantity: string;
  driver: string | null;
  gateId: string;
  status: ShipmentStatus;
}

export interface GatePreview {
  id: string;
  name: string;
  connection: string;
  status: GateStatus;
}
