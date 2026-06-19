import "server-only";
import { prisma } from "@bnb/core/db";
import type { Role } from "@prisma/client";
import { getAuthConfig } from "./config";
import { generateToken } from "./tokens";

/**
 * Staff invites are token-only here — Phase 11 sends the email. The owner mints
 * an invite for an email+role; we create (or reuse) the target User up front so
 * redeeming the token simply enrols a passkey for that user. The returned token
 * is what P11 will embed in the invite link.
 */

export interface MintInviteInput {
  email: string;
  role?: Role;
  displayName?: string;
}

export interface MintedInvite {
  token: string;
  email: string;
  role: Role;
  userId: string;
  expiresAt: Date;
  /** Convenience: the path P11 emails (origin is environment-pinned). */
  url: string;
}

export async function mintStaffInvite(
  input: MintInviteInput,
): Promise<MintedInvite> {
  const cfg = getAuthConfig();
  const email = input.email.trim().toLowerCase();
  const role: Role = input.role ?? "ARTIST";

  // Create or fetch the User the invite enrols a device for.
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role,
      displayName: input.displayName?.trim() || email.split("@")[0],
    },
    update: { role },
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + cfg.inviteTtlSeconds * 1000);

  await prisma.staffInvite.create({
    data: { token, email, role, userId: user.id, expiresAt },
  });

  return {
    token,
    email,
    role,
    userId: user.id,
    expiresAt,
    url: `${cfg.origin}/sign-in?invite=${token}`,
  };
}

export interface RedeemableInvite {
  userId: string;
  email: string;
  role: Role;
}

/**
 * Validate an invite token (unredeemed + unexpired). Returns the target user so
 * the enrolment flow can start a registration ceremony. Does NOT mark redeemed —
 * call `markInviteRedeemed` only after the passkey is successfully stored.
 */
export async function resolveInvite(
  token: string,
): Promise<RedeemableInvite | null> {
  const invite = await prisma.staffInvite.findUnique({ where: { token } });
  if (!invite) return null;
  if (invite.redeemedAt) return null;
  if (invite.expiresAt.getTime() < Date.now()) return null;
  if (!invite.userId) return null;
  return { userId: invite.userId, email: invite.email, role: invite.role };
}

export async function markInviteRedeemed(token: string): Promise<void> {
  await prisma.staffInvite.updateMany({
    where: { token, redeemedAt: null },
    data: { redeemedAt: new Date() },
  });
}
