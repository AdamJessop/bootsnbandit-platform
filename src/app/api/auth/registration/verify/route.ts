import { NextResponse } from "next/server";
import { z } from "zod";
import { finishRegistration } from "@bnb/core/auth/webauthn";
import { getCurrentUser } from "@bnb/core/auth";
import { resolveInvite, markInviteRedeemed } from "@bnb/core/auth/invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // RegistrationResponseJSON from @simplewebauthn/browser
  response: z.record(z.string(), z.unknown()),
  deviceName: z.string().max(120).optional(),
  invite: z.string().min(1).optional(),
});

/**
 * Complete passkey enrolment: verify the attestation, persist the Authenticator,
 * mint a session, and mark the invite redeemed (if one was used).
 */
export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Authorize: either a valid invite or an existing session.
  if (body.invite) {
    if (!(await resolveInvite(body.invite))) {
      return NextResponse.json(
        { error: "Invite is invalid or expired" },
        { status: 400 },
      );
    }
  } else if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const result = await finishRegistration(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body.response as any,
      body.deviceName ?? null,
    );
    if (!result.verified) {
      return NextResponse.json(
        { verified: false, error: "Verification failed" },
        { status: 400 },
      );
    }
    if (body.invite) {
      await markInviteRedeemed(body.invite);
    }
    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { verified: false, error: "Registration could not be completed" },
      { status: 400 },
    );
  }
}
