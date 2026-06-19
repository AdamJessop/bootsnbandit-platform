import "server-only";
import type { Role } from "@prisma/client";
import { mintStaffInvite, type MintedInvite } from "@/lib/auth/invite";
import { sendEmail } from "@/lib/email";

/**
 * Staff-invite orchestration (Studio › Staff, K1). Mints a `StaffInvite` token
 * (P4) then sends the invitee an email (P5 `sendEmail`) carrying the redeem URL
 * so they can enrol their first passkey at `/sign-in?invite=<token>`.
 *
 * Uses the dedicated `staff_invite` email template (added in P12); the invite
 * URL, role and expiry are carried in `data`.
 */

export interface InviteStaffInput {
  email: string;
  role?: Role;
  displayName?: string;
}

export async function inviteStaff(
  input: InviteStaffInput,
): Promise<MintedInvite> {
  const invite = await mintStaffInvite({
    email: input.email,
    role: input.role,
    displayName: input.displayName,
  });

  await sendEmail({
    to: invite.email,
    type: "staff_invite",
    data: {
      inviteeName: input.displayName ?? invite.email,
      url: invite.url,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });

  return invite;
}
