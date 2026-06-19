import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  StaffManager,
  type StaffMember,
} from "../_components/StaffManager";
import {
  inviteStaffAction,
  removePasskeyAction,
  setActiveAction,
  setRoleAction,
} from "../_lib/actions";

/** Studio › Staff (K1). Owner-only. */
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  await requireRole("OWNER");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
    include: {
      authenticators: {
        select: { id: true, deviceName: true, createdAt: true },
      },
    },
  });

  const staff: StaffMember[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    active: u.active,
    passkeys: u.authenticators.map((a) => ({
      id: a.id,
      deviceName: a.deviceName,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Staff &amp; users
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Invite staff, set roles, enable or disable accounts, manage passkeys.
      </p>
      <StaffManager
        staff={staff}
        inviteAction={inviteStaffAction}
        setRoleAction={setRoleAction}
        setActiveAction={setActiveAction}
        removePasskeyAction={removePasskeyAction}
      />
    </main>
  );
}
