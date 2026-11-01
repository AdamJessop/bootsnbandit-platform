import "server-only";
import type { Role } from "@prisma/client";
import { mintStaffInvite, type MintedInvite } from "@bnb/core/auth/invite";
import { sendEmail } from "@bnb/core/email";

/**
 * Staff-invite orchestration (Studio › Staff, K1). Mints a `StaffInvite` token
 * (P4) then sends the invitee an email (P5 `sendEmail`) carrying the redeem URL
 * so they can enrol their first passkey at `/sign-in?invite=<token>`.
 *
 * Uses the dedicated `staff_invite` email template (added in P12); the invite
 * URL, role and expiry are carried in `data`.
 *
 * `sendEmail` never throws (a Resend error comes back as `status: "failed"`, a
 * missing API key as `"skipped"`), so the outcome is surfaced as `emailed` for
 * the owner to fall back to copying the link.
 */

export interface InviteStaffInput {
  email: string;
  /** Omit to keep an existing user's role (new users default to ARTIST). */
  role?: Role;
  displayName?: string;
}

export interface SentInvite extends MintedInvite {
  /** True only when Resend accepted the email. */
  emailed: boolean;
}

export async function inviteStaff(input: InviteStaffInput): Promise<SentInvite> {
  const invite = await mintStaffInvite({
    email: input.email,
    role: input.role,
    displayName: input.displayName,
  });

  const emailed = await sendInviteEmail({
    email: invite.email,
    url: invite.url,
    role: invite.role,
    expiresAt: invite.expiresAt,
    inviteeName: input.displayName,
  });

  return { ...invite, emailed };
}

export interface InviteEmail {
  email: string;
  url: string;
  role: Role;
  expiresAt: Date;
  inviteeName?: string;
}

/** Send (or re-send) the invite email. Returns whether it actually went out. */
export async function sendInviteEmail(invite: InviteEmail): Promise<boolean> {
  const res = await sendEmail({
    to: invite.email,
    type: "staff_invite",
    data: {
      inviteeName: invite.inviteeName ?? invite.email,
      url: invite.url,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });
  return res.status === "sent";
}
