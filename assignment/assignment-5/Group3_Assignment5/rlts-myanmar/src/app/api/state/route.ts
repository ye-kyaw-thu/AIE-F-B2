import { NextResponse } from "next/server";
import { readState } from "@/lib/server/db";

export const dynamic = "force-dynamic"; // always read live state, never cache

export async function GET() {
  return NextResponse.json(readState());
}
