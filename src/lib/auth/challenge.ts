import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getAuthConfig } from "./config";
import {
  writeChallengeCookie,
  readChallengeCookie,
  clearChallengeCookie,
} from "./cookies";

/**
 * Short-lived WebAuthn challenge storage. We persist the challenge in the DB
 * (WebAuthnChallenge) keyed by an opaque random `handle`; the handle lives in an
 * HttpOnly cookie. This binds a browser to exactly one pending ceremony without
 * trusting the client with the challenge value, and survives the stateless
 * options -> verify round-trip across separate route handlers.
 */

export type Ceremony = "registration" | "authentication";

export interface IssuedChallenge {
  handle: string;
  challenge: string;
}

function newHandle(): string {
  return randomBytes(24).toString("base64url");
}

export async function issueChallenge(args: {
  challenge: string;
  ceremony: Ceremony;
  userId?: string | null;
  email?: string | null;
}): Promise<void> {
  const cfg = getAuthConfig();
  const handle = newHandle();
  const expiresAt = new Date(Date.now() + cfg.challengeTtlSeconds * 1000);

  await prisma.webAuthnChallenge.create({
    data: {
      handle,
      challenge: args.challenge,
      ceremony: args.ceremony,
      userId: args.userId ?? null,
      email: args.email ?? null,
      expiresAt,
    },
  });
  // Opportunistic cleanup of expired rows.
  await prisma.webAuthnChallenge
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  await writeChallengeCookie(handle);
}

export interface ConsumedChallenge {
  challenge: string;
  ceremony: Ceremony;
  userId: string | null;
  email: string | null;
}

/**
 * Read + delete (single-use) the pending challenge for this browser. Returns
 * null if missing, expired, or the cookie/DB are out of sync.
 */
export async function consumeChallenge(): Promise<ConsumedChallenge | null> {
  const handle = await readChallengeCookie();
  if (!handle) return null;

  const row = await prisma.webAuthnChallenge.findUnique({ where: { handle } });
  await clearChallengeCookie();

  if (!row) return null;
  // Always delete the row once we've claimed the handle (single use).
  await prisma.webAuthnChallenge.delete({ where: { handle } }).catch(() => {});

  if (row.expiresAt.getTime() < Date.now()) return null;

  return {
    challenge: row.challenge,
    ceremony: row.ceremony as Ceremony,
    userId: row.userId,
    email: row.email,
  };
}
