// Dashboard KPI computations — see ../LOGISTICS_GLOSSARY.md §3 for the full proposed set
// and why each one is scoped the way it is. Deliberately count-based, not rate-based:
// with a handful of shipments in the demo, a rate like "on-time %" swings wildly and
// means little (see the glossary's "Small-N statistics" note). Kept as pure functions
// over already-fetched state, not new API calls, so they're cheap to compute on every
// render and trivial to unit-test in isolation from the UI.

import type { BorderGate, EmergencyBroadcast, Shipment } from "@/lib/types";
import { convertCurrency } from "@/lib/currency";

export interface FleetKpis {
  activeShipments: number;
  inTransit: number;
  heldAtCheckpoint: number;
  inCustoms: number;
  delayed: number;
  cargoValueUsd: number;
  gatesOpen: number;
  gatesCongested: number;
  gatesClosed: number;
  activeCriticalAlerts: number;
}

/** Fleet-wide KPIs — the Admin console's set, over every shipment in the system. */
export function computeFleetKpis(shipments: Shipment[], gates: BorderGate[], broadcasts: EmergencyBroadcast[]): FleetKpis {
  const active = shipments.filter((s) => s.currentStatus !== "DELIVERED");

  const cargoValueUsd = active.reduce(
    (sum, s) => sum + convertCurrency(s.cargoValue, s.cargoValueCurrency, "USD"),
    0
  );

  const closedLike = new Set(["CLOSED", "EMERGENCY_HALT", "ARMED_INSPECTION", "FLOODING"]);

  return {
    activeShipments: active.length,
    inTransit: shipments.filter((s) => s.currentStatus === "IN_TRANSIT").length,
    heldAtCheckpoint: shipments.filter((s) => s.currentStatus === "HELD_AT_CHECKPOINT").length,
    inCustoms: shipments.filter((s) => s.currentStatus === "CUSTOMS_PROCESSING").length,
    delayed: shipments.filter((s) => s.isDelayed).length,
    cargoValueUsd,
    gatesOpen: gates.filter((g) => g.status === "OPEN").length,
    gatesCongested: gates.filter((g) => g.status === "CONGESTED").length,
    gatesClosed: gates.filter((g) => closedLike.has(g.status)).length,
    activeCriticalAlerts: broadcasts.filter((b) => b.isActive && b.severity === "CRITICAL").length,
  };
}

export interface TraderKpis {
  activeShipments: number;
  delayed: number;
  cargoValueUsd: number;
}

/** Same idea, scoped to one trader's own shipments only — no fleet-wide visibility for a trader. */
export function computeTraderKpis(myShipments: Shipment[]): TraderKpis {
  const active = myShipments.filter((s) => s.currentStatus !== "DELIVERED");
  return {
    activeShipments: active.length,
    delayed: myShipments.filter((s) => s.isDelayed).length,
    cargoValueUsd: active.reduce((sum, s) => sum + convertCurrency(s.cargoValue, s.cargoValueCurrency, "USD"), 0),
  };
}
