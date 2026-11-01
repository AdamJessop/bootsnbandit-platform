import { requireRole } from "@bnb/core/auth";
import { listPendingInvites } from "@bnb/core/auth/invite";
import { prisma } from "@bnb/core/db";
import {
  StaffManager,
  type StaffInviteRow,
  type StaffMember,
} from "../_components/StaffManager";
import {
  inviteStaffAction,
  removePasskeyAction,
  resendInviteAction,
  setActiveAction,
  setRoleAction,
  updateStaffDetailsAction,
} from "../_lib/actions";

/** Studio › Staff (K1). Owner-only. */
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const me = await requireRole("OWNER");
  const [users, pending] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
      include: {
        authenticators: {
          select: { id: true, deviceName: true, createdAt: true },
        },
        artist: { select: { slug: true, status: true } },
      },
    }),
    listPendingInvites(),
  ]);

  const staff: StaffMember[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    active: u.active,
    artist: u.artist ? { slug: u.artist.slug, status: u.artist.status } : null,
    passkeys: u.authenticators.map((a) => ({
      id: a.id,
      deviceName: a.deviceName,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  const invites: StaffInviteRow[] = pending.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    url: i.url,
    expiresAt: i.expiresAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Staff &amp; users
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Invite staff, set roles, fix names and emails, enable or disable
        accounts, manage passkeys.
      </p>
      <StaffManager
        staff={staff}
        invites={invites}
        currentUserId={me.id}
        inviteAction={inviteStaffAction}
        resendInviteAction={resendInviteAction}
        setRoleAction={setRoleAction}
        setActiveAction={setActiveAction}
        removePasskeyAction={removePasskeyAction}
        updateDetailsAction={updateStaffDetailsAction}
      />
    </main>
  );
}
