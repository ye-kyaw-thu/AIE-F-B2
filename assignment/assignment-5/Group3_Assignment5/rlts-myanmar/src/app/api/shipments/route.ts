import { NextResponse } from "next/server";
import { mutate, newId } from "@/lib/server/db";
import { DEMO_USERS } from "@/lib/auth/users";
import { NORTHERN_CORRIDOR } from "@/lib/geo/myanmar-routes";
import type { Currency, Shipment } from "@/lib/types";

export const dynamic = "force-dynamic";

function randomTrackingNumber(): string {
  return `MM-TRK-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Data-entry-clerk shipment intake. This is the "simplify the process: a clerk enters
 * the route, driver, cargo first" workflow — the record created here is immediately
 * visible to the assigned driver (via driverUsername) and trader (via traderUsername)
 * because everyone now reads from this same server state, not a per-browser copy.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.driverUsername || !body?.traderUsername || !body?.targetGateId || !body?.cargoType) {
    return NextResponse.json(
      { ok: false, error: "driverUsername, traderUsername, targetGateId and cargoType are required" },
      { status: 400 }
    );
  }

  const driver = DEMO_USERS.find((u) => u.username === body.driverUsername && u.role === "truck_driver");
  const trader = DEMO_USERS.find((u) => u.username === body.traderUsername && u.role === "cargo_trader");
  if (!driver || !trader) {
    return NextResponse.json({ ok: false, error: "Unknown driver or trader account." }, { status: 400 });
  }

  const state = await mutate((s) => {
    const gate = s.gates.find((g) => g.id === body.targetGateId);
    const origin = NORTHERN_CORRIDOR[0]; // Yangon depot — shared origin for both corridors

    const trackingNumber: string =
      typeof body.trackingNumber === "string" && body.trackingNumber.trim() ? body.trackingNumber.trim() : randomTrackingNumber();

    const shipment: Shipment = {
      id: newId(),
      trackingNumber,
      traderName: trader.displayName,
      traderUsername: trader.username,
      driverName: driver.displayName,
      driverUsername: driver.username,
      cargoType: body.cargoType,
      cargoWeightTons: Number(body.cargoWeightTons) || 0,
      cargoValue: Number(body.cargoValue) || 0,
      cargoValueCurrency: (body.cargoValueCurrency as Currency) || "USD",
      originName: origin.name ?? "Yangon",
      destinationName: gate ? gate.name : body.destinationName || "Unknown destination",
      targetGateId: body.targetGateId,
      currentStatus: "PICKED_UP",
      currentLat: origin.lat,
      currentLng: origin.lng,
      routeProgress: 0,
      isDelayed: false,
      delayReason: null,
      createdAt: new Date().toISOString(),
      estimatedArrival:
        body.estimatedArrival || new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      createdBy: body.createdBy ?? null,
    };

    return { ...s, shipments: [...s.shipments, shipment] };
  });

  return NextResponse.json(state);
}
