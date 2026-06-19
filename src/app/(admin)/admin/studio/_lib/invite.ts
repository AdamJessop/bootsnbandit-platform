import "server-only";
import type { Role } from "@prisma/client";
import { mintStaffInvite, type MintedInvite } from "@/lib/auth/invite";
import { sendEmail } from "@/lib/email";

/**
 * Staff-invite orchestration (Studio › Staff, K1). Mints a `StaffInvite` token
 * (P4) then sends the invitee an email (P5 `sendEmail`) carrying the redeem URL
 * so they can enrol their first passkey at `/sign-in?invite=<token>`.
 *
 * NOTE: the email `EmailType` union (owned by P5) has no dedicated `staff_invite`
 * template, so we send via the `confirmation` transport and carry the invite
 * details (url/role) in `data`. When P5/P12 adds an invite template, only the
 * `type` here changes — the orchestration + MessageLog row are already correct.
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
    type: "confirmation",
    data: {
      customerName: input.displayName ?? invite.email,
      kind: "staff_invite",
      url: invite.url,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });

  return invite;
}
