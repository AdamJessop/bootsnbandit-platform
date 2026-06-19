import { NextResponse } from "next/server";
import { clearSessionCookie } from "@bnb/core/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign out: clear the session cookie. */
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
