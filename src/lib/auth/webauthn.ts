import "server-only";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { getAuthConfig, dbRoleToSessionRole } from "./config";
import { issueChallenge, consumeChallenge } from "./challenge";
import { writeSessionCookie } from "./cookies";
import { ensureCalendarFeed } from "./calendar-feed";
import type { SessionPayload } from "./session";

/**
 * WebAuthn ceremony orchestration. Route handlers are thin wrappers over these:
 * generate options (+ persist challenge) and verify responses (+ persist
 * credential / advance counter / mint session).
 */

// ---------------------------------------------------------------------------
// Registration (passkey enrolment for an existing User)
// ---------------------------------------------------------------------------

export async function startRegistration(
  userId: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const cfg = getAuthConfig();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { authenticators: true },
  });
  if (!user || !user.active) {
    throw new Error("User not found or inactive");
  }

  const options = await generateRegistrationOptions({
    rpName: cfg.rpName,
    rpID: cfg.rpID,
    userName: user.email,
    userDisplayName: user.displayName,
    attestationType: "none",
    excludeCredentials: user.authenticators.map((a) => ({
      id: a.credentialID,
      transports: a.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await issueChallenge({
    challenge: options.challenge,
    ceremony: "registration",
    userId: user.id,
  });

  return options;
}

export interface RegistrationVerifyResult {
  verified: boolean;
}

export async function finishRegistration(
  response: RegistrationResponseJSON,
  deviceName?: string | null,
): Promise<RegistrationVerifyResult> {
  const cfg = getAuthConfig();
  const pending = await consumeChallenge();
  if (!pending || pending.ceremony !== "registration" || !pending.userId) {
    throw new Error("No matching registration challenge");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: cfg.origin,
    expectedRPID: cfg.rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential } = verification.registrationInfo;

  await prisma.authenticator.create({
    data: {
      userId: pending.userId,
      credentialID: credential.id,
      credentialPublicKey: credential.publicKey,
      counter: BigInt(credential.counter),
      transports: (credential.transports ?? []) as string[],
      deviceName: deviceName ?? null,
      lastUsedAt: new Date(),
    },
  });

  // Mint a session immediately so first-device enrolment lands signed-in.
  await mintSessionForUser(pending.userId);

  return { verified: true };
}

// ---------------------------------------------------------------------------
// Authentication (email-first sign-in)
// ---------------------------------------------------------------------------

export async function startAuthentication(
  email: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const cfg = getAuthConfig();
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { authenticators: true },
  });

  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    userVerification: "preferred",
    allowCredentials:
      user && user.active
        ? user.authenticators.map((a) => ({
            id: a.credentialID,
            transports: a.transports as AuthenticatorTransportFuture[],
          }))
        : [],
  });

  // Persist challenge keyed by email even for unknown users so the timing and
  // shape of the response don't leak account existence.
  await issueChallenge({
    challenge: options.challenge,
    ceremony: "authentication",
    email: normalized,
  });

  return options;
}

export interface AuthenticationVerifyResult {
  verified: boolean;
}

export async function finishAuthentication(
  response: AuthenticationResponseJSON,
): Promise<AuthenticationVerifyResult> {
  const cfg = getAuthConfig();
  const pending = await consumeChallenge();
  if (!pending || pending.ceremony !== "authentication") {
    throw new Error("No matching authentication challenge");
  }

  const authenticator = await prisma.authenticator.findUnique({
    where: { credentialID: response.id },
    include: { user: true },
  });
  if (!authenticator || !authenticator.user.active) {
    return { verified: false };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: cfg.origin,
    expectedRPID: cfg.rpID,
    requireUserVerification: false,
    credential: {
      id: authenticator.credentialID,
      publicKey: authenticator.credentialPublicKey,
      counter: Number(authenticator.counter),
      transports: authenticator.transports as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) {
    return { verified: false };
  }

  // Advance the stored counter (replay protection) + record usage.
  await prisma.authenticator.update({
    where: { id: authenticator.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  await mintSessionForUser(authenticator.userId);
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Session minting
// ---------------------------------------------------------------------------

async function mintSessionForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { artist: true },
  });
  if (!user) throw new Error("User vanished mid-ceremony");

  // An artist enrolling/logging in always has a CalendarFeed bootstrapped.
  if (user.artist) {
    await ensureCalendarFeed(user.artist.id);
  }

  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    role: dbRoleToSessionRole(user.role),
    displayName: user.displayName,
    artistId: user.artist?.id ?? null,
  };
  await writeSessionCookie(payload);
}
