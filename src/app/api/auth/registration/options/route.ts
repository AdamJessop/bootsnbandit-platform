import { NextResponse } from "next/server";
import { z } from "zod";
import { startRegistration } from "@/lib/auth/webauthn";
import { getCurrentUser } from "@/lib/auth";
import { resolveInvite } from "@/lib/auth/invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ invite: z.string().min(1).optional() });

/**
 * Begin passkey enrolment. Two entry points:
 *  - a signed-in staff member adding another device (session-derived user), or
 *  - an invited staff member redeeming a token (first device).
 */
export async function POST(req: Request) {
  let invite: string | undefined;
  try {
    const json = await req.json().catch(() => ({}));
    invite = bodySchema.parse(json).invite;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let userId: string | null = null;

  if (invite) {
    const resolved = await resolveInvite(invite);
    if (!resolved) {
      return NextResponse.json(
        { error: "Invite is invalid or expired" },
        { status: 400 },
      );
    }
    userId = resolved.userId;
  } else {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    userId = current.id;
  }

  const options = await startRegistration(userId);
  return NextResponse.json(options);
}
