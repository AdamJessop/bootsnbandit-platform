import "server-only";
import { prisma } from "@bnb/core/db";
import type { Role } from "@prisma/client";
import { getAuthConfig } from "./config";
import { generateToken } from "./tokens";

/**
 * Staff invites are token-only here — Phase 11 sends the email. The owner mints
 * an invite for an email+role; we create (or reuse) the target User up front so
 * redeeming the token simply enrols a passkey for that user. The returned token
 * is what P11 will embed in the invite link. Pending invites are listed back to
 * the owner (with their link) so one can be copied or re-sent when the email
 * doesn't arrive.
 */

export interface MintInviteInput {
  email: string;
  /**
   * Only applied when explicitly given. A re-invite (e.g. a new phone) for an
   * existing user keeps their current role when this is omitted — it must
   * never silently demote an owner. New users default to ARTIST.
   */
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

  // Create or fetch the User the invite enrols a device for. An existing
  // user's role only changes when the owner explicitly picked one.
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role: input.role ?? "ARTIST",
      displayName: input.displayName?.trim() || email.split("@")[0],
    },
    update: input.role ? { role: input.role } : {},
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + cfg.inviteTtlSeconds * 1000);

  await prisma.staffInvite.create({
    data: { token, email, role: user.role, userId: user.id, expiresAt },
  });

  return {
    token,
    email,
    role: user.role,
    userId: user.id,
    expiresAt,
    url: inviteUrl(token),
  };
}

/** The redeem link for an invite token (origin is environment-pinned). */
export function inviteUrl(token: string): string {
  return `${getAuthConfig().origin}/sign-in?invite=${token}`;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  userId: string | null;
  expiresAt: Date;
  createdAt: Date;
  url: string;
}

/**
 * Unredeemed, unexpired invites, newest first, one per email (a re-invite
 * supersedes the owner's view of the older link, though both still work until
 * they expire).
 */
export async function listPendingInvites(
  now: Date = new Date(),
): Promise<PendingInvite[]> {
  const rows = await prisma.staffInvite.findMany({
    where: { redeemedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const out: PendingInvite[] = [];
  for (const r of rows) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    out.push({
      id: r.id,
      email: r.email,
      role: r.role,
      userId: r.userId,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      url: inviteUrl(r.token),
    });
  }
  return out;
}

/** One pending invite by id, or null when it's gone, used or expired. */
export async function findPendingInvite(
  id: string,
  now: Date = new Date(),
): Promise<PendingInvite | null> {
  const r = await prisma.staffInvite.findUnique({ where: { id } });
  if (!r || r.redeemedAt || r.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    userId: r.userId,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    url: inviteUrl(r.token),
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
