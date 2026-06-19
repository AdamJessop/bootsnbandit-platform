/**
 * End-to-end DB-backed proof of the auth persistence flow against the live
 * dockerised Postgres. Exercises the same persistence logic the route handlers
 * use — without the cookie/next-headers layer — so we verify:
 *   - a passkey is stored as an Authenticator row (id, publicKey, counter)
 *   - a subsequent assertion verifies and advances the stored counter
 *   - an artist user gets a CalendarFeed bootstrapped (unique token)
 *   - a staff invite mints a token + target user, and resolves once
 *
 * Skips gracefully when no DB is reachable (matches the seed-counts pattern).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import {
  createSoftCredential,
  buildRegistrationResponse,
  buildAuthenticationResponse,
} from "./__fixtures__/softAuthenticator";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // env may be provided directly
}

const rpID = process.env.RP_ID || "localhost";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";

let prisma: PrismaClient;
let reachable = false;

function uid(p = "t"): string {
  return `${p}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  prisma = new PrismaClient({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: adapter as any,
    log: ["error"],
  });
  try {
    await prisma.$queryRaw`SELECT 1`;
    reachable = true;
  } catch {
    reachable = false;
  }
});

// Track only rows we create so cleanup never touches seeded content. We never
// insert into shared content tables (e.g. Artist) so we don't race the
// seed-count assertions that run in parallel against the same database.
const created: { users: string[]; feedArtistIds: string[] } = {
  users: [],
  feedArtistIds: [],
};

afterAll(async () => {
  if (reachable) {
    // Remove any CalendarFeed we bootstrapped against a seeded artist.
    for (const artistId of created.feedArtistIds) {
      await prisma.calendarFeed.deleteMany({ where: { artistId } }).catch(() => {});
    }
    // Deleting users cascades to their authenticators + staff invites.
    for (const id of created.users) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  }
  if (prisma) await prisma.$disconnect();
});

describe("auth persistence (DB-backed)", () => {
  it("registers then authenticates a passkey, advancing the stored counter", async () => {
    if (!reachable) {
      console.warn("[auth integration] DB unreachable — skipping");
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: `${uid("auth")}@example.com`,
        role: "ARTIST",
        displayName: "Round Trip",
      },
    });
    created.users.push(user.id);

    // --- registration ceremony ---
    const regOptions = await generateRegistrationOptions({
      rpName: "Boots 'n' Bandit",
      rpID,
      userName: user.email,
      userDisplayName: user.displayName,
      attestationType: "none",
    });
    const cred = await createSoftCredential(rpID);
    const regResponse = buildRegistrationResponse(
      cred,
      regOptions.challenge,
      origin,
    );
    const reg = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: regResponse as any,
      expectedChallenge: regOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    expect(reg.verified).toBe(true);
    const info = reg.registrationInfo!;

    const stored = await prisma.authenticator.create({
      data: {
        userId: user.id,
        credentialID: info.credential.id,
        credentialPublicKey: info.credential.publicKey,
        counter: BigInt(info.credential.counter),
        transports: (info.credential.transports ?? []) as string[],
      },
    });
    expect(stored.counter).toBe(BigInt(0));

    // --- authentication ceremony ---
    const authOptions = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{ id: stored.credentialID }],
    });
    const assertion = await buildAuthenticationResponse(
      cred,
      authOptions.challenge,
      origin,
    );

    const dbCred = await prisma.authenticator.findUnique({
      where: { credentialID: assertion.id },
    });
    expect(dbCred).not.toBeNull();

    const auth = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: assertion as any,
      expectedChallenge: authOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: dbCred!.credentialID,
        publicKey: dbCred!.credentialPublicKey,
        counter: Number(dbCred!.counter),
        transports: dbCred!.transports as AuthenticatorTransportFuture[],
      },
    });
    expect(auth.verified).toBe(true);

    const updated = await prisma.authenticator.update({
      where: { id: stored.id },
      data: { counter: BigInt(auth.authenticationInfo.newCounter) },
    });
    expect(Number(updated.counter)).toBeGreaterThan(0);
  });

  it("bootstraps a unique CalendarFeed for an artist (idempotent)", async () => {
    if (!reachable) return;

    // Use a seeded artist WITHOUT a feed so we don't mutate existing data or
    // race the seed-count tests by inserting into the Artist table.
    const artist = await prisma.artist.findFirst({
      where: { calendarFeed: null },
      select: { id: true },
    });
    if (!artist) {
      console.warn("[auth integration] no feed-less artist seeded — skipping");
      return;
    }
    created.feedArtistIds.push(artist.id);

    const mkToken = () => randomBytes(32).toString("base64url");
    const first = await prisma.calendarFeed.upsert({
      where: { artistId: artist.id },
      create: { artistId: artist.id, token: mkToken() },
      update: {},
    });
    const second = await prisma.calendarFeed.upsert({
      where: { artistId: artist.id },
      create: { artistId: artist.id, token: mkToken() },
      update: {},
    });

    expect(first.token).toBeTruthy();
    expect(first.token).toBe(second.token); // idempotent
    expect(first.id).toBe(second.id);
  });

  it("mints + resolves a staff invite token once", async () => {
    if (!reachable) return;

    const email = `${uid("inv")}@example.com`;
    const user = await prisma.user.create({
      data: { email, role: "ARTIST", displayName: "Invitee" },
    });
    created.users.push(user.id);

    const token = randomBytes(32).toString("base64url");
    await prisma.staffInvite.create({
      data: {
        token,
        email,
        role: "ARTIST",
        userId: user.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const found = await prisma.staffInvite.findUnique({ where: { token } });
    expect(found?.userId).toBe(user.id);
    expect(found?.redeemedAt).toBeNull();

    await prisma.staffInvite.updateMany({
      where: { token, redeemedAt: null },
      data: { redeemedAt: new Date() },
    });
    const after = await prisma.staffInvite.findUnique({ where: { token } });
    expect(after?.redeemedAt).not.toBeNull();
  });
});
