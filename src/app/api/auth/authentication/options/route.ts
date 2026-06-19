import { NextResponse } from "next/server";
import { z } from "zod";
import { startAuthentication } from "@/lib/auth/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email() });

/** Begin sign-in: issue an assertion challenge for the given email. */
export async function POST(req: Request) {
  let email: string;
  try {
    email = bodySchema.parse(await req.json()).email;
  } catch {
    return NextResponse.json(
      { error: "A valid email is required" },
      {
        status: 400,
      },
    );
  }

  const options = await startAuthentication(email);
  return NextResponse.json(options);
}
