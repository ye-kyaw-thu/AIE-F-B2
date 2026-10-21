import { NextResponse } from "next/server";
import { mutate } from "@/lib/server/db";
import type { GateStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const status = body?.status as GateStatus | undefined;
  if (!status) return NextResponse.json({ ok: false, error: "status is required" }, { status: 400 });

  const state = await mutate((s) => ({
    ...s,
    gates: s.gates.map((g) =>
      g.id === params.id
        ? {
            ...g,
            status,
            closureReason: body?.reason ?? null,
            updatedAt: new Date().toISOString(),
            updatedBy: body?.updatedBy ?? null,
          }
        : g
    ),
  }));
  return NextResponse.json(state);
}
