import { NextResponse } from "next/server";
import { mutate } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const state = await mutate((s) => ({
    ...s,
    broadcasts: s.broadcasts.map((b) => (b.id === params.id ? { ...b, isActive: false } : b)),
  }));
  return NextResponse.json(state);
}
