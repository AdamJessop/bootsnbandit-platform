import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@bnb/core/auth";
import { mintStaffInvite } from "@bnb/core/auth/invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ARTIST"]).optional(),
  displayName: z.string().min(1).max(120).optional(),
});

/**
 * Owner mints a staff invite. Token only — Phase 11 emails it. Returns the
 * token + url so the owner UI / P11 can send the invite link.
 */
export async function POST(req: Request) {
  // OWNER-only; requireRole redirects unauthenticated callers, but for an API
  // we surface a 401 instead by checking the session ourselves is unnecessary —
  // requireRole throws a redirect which Next turns into a 3xx for fetch. To keep
  // a clean JSON contract we guard explicitly.
  await requireRole("OWNER");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const invite = await mintStaffInvite({
    email: body.email,
    role: body.role,
    displayName: body.displayName,
  });

  return NextResponse.json({
    token: invite.token,
    url: invite.url,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
  });
}
