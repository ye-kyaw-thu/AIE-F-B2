import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

// Same demo-credential model as before (src/lib/auth/users.ts), now validated
// server-side so a device other than the browser it was written for — like the Flutter
// driver app — can authenticate against the same account list.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");

  const match = DEMO_USERS.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );

  if (!match) {
    return NextResponse.json({ ok: false, error: "Incorrect username or password." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    session: { username: match.username, displayName: match.displayName, role: match.role },
  });
}
