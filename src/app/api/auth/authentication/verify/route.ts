import { NextResponse } from "next/server";
import { z } from "zod";
import { finishAuthentication } from "@bnb/core/auth/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // AuthenticationResponseJSON from @simplewebauthn/browser
  response: z.record(z.string(), z.unknown()),
});

/** Complete sign-in: verify the assertion, advance the counter, mint a session. */
export async function POST(req: Request) {
  let response: unknown;
  try {
    response = bodySchema.parse(await req.json()).response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await finishAuthentication(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response as any,
    );
    if (!result.verified) {
      return NextResponse.json(
        { verified: false, error: "Authentication failed" },
        { status: 401 },
      );
    }
    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { verified: false, error: "Authentication failed" },
      { status: 401 },
    );
  }
}
