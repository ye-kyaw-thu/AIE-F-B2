import { NextResponse } from "next/server";
import { mutate } from "@/lib/server/db";
import { DEMO_USERS } from "@/lib/auth/users";
import type { Currency, Shipment } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Correct a shipment after intake — the gap this closes: before this route existed,
 * the only way to fix bad clerk-entered data was "Reset demo state" (which wipes
 * everything, gates and broadcasts included) or editing the server's data file
 * directly over SSH. This is the self-service version of that fix, scoped to Admin
 * (RequireRole on the page, not enforced here — see the README's note on this being a
 * demo auth model, not a real authorization boundary).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });

  let notFound = false;

  const state = await mutate((s) => {
    const existing = s.shipments.find((sh) => sh.id === params.id);
    if (!existing) {
      notFound = true;
      return s;
    }

    const driver = body.driverUsername
      ? DEMO_USERS.find((u) => u.username === body.driverUsername && u.role === "truck_driver")
      : null;
    const trader = body.traderUsername
      ? DEMO_USERS.find((u) => u.username === body.traderUsername && u.role === "cargo_trader")
      : null;
    const gate = body.targetGateId ? s.gates.find((g) => g.id === body.targetGateId) : null;

    const patch: Partial<Shipment> = {};
    if (typeof body.trackingNumber === "string" && body.trackingNumber.trim()) {
      patch.trackingNumber = body.trackingNumber.trim();
    }
    if (driver) {
      patch.driverUsername = driver.username;
      patch.driverName = driver.displayName;
    }
    if (trader) {
      patch.traderUsername = trader.username;
      patch.traderName = trader.displayName;
    }
    if (typeof body.cargoType === "string" && body.cargoType.trim()) patch.cargoType = body.cargoType.trim();
    if (body.cargoWeightTons !== undefined) patch.cargoWeightTons = Number(body.cargoWeightTons) || 0;
    if (body.cargoValue !== undefined) patch.cargoValue = Number(body.cargoValue) || 0;
    if (body.cargoValueCurrency) patch.cargoValueCurrency = body.cargoValueCurrency as Currency;
    if (gate) {
      patch.targetGateId = gate.id;
      patch.destinationName = gate.name;
    }
    if (body.estimatedArrival) patch.estimatedArrival = body.estimatedArrival;

    return {
      ...s,
      shipments: s.shipments.map((sh) => (sh.id === params.id ? { ...sh, ...patch } : sh)),
    };
  });

  if (notFound) return NextResponse.json({ ok: false, error: "Shipment not found" }, { status: 404 });
  return NextResponse.json(state);
}

/** Removes the shipment and, matching supabase/schema.sql's ON DELETE CASCADE intent, its telemetry history. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let notFound = false;

  const state = await mutate((s) => {
    if (!s.shipments.some((sh) => sh.id === params.id)) {
      notFound = true;
      return s;
    }
    return {
      ...s,
      shipments: s.shipments.filter((sh) => sh.id !== params.id),
      telemetry: s.telemetry.filter((t) => t.shipmentId !== params.id),
    };
  });

  if (notFound) return NextResponse.json({ ok: false, error: "Shipment not found" }, { status: 404 });
  return NextResponse.json(state);
}
