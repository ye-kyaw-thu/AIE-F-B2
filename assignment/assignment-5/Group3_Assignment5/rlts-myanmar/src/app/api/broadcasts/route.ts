import { NextResponse } from "next/server";
import { mutate, newId } from "@/lib/server/db";
import type { EmergencyBroadcast } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.message) {
    return NextResponse.json({ ok: false, error: "title and message are required" }, { status: 400 });
  }

  const broadcast: EmergencyBroadcast = {
    id: newId(),
    title: body.title,
    message: body.message,
    severity: body.severity ?? "CRITICAL",
    gateId: body.gateId ?? null,
    routeAffected: body.routeAffected ?? null,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const state = await mutate((s) => ({ ...s, broadcasts: [broadcast, ...s.broadcasts] }));
  return NextResponse.json(state);
}
