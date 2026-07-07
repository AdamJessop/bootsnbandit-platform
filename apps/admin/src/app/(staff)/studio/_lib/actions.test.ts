import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const inviteStaff = vi.fn();
const revalidatePath = vi.fn();
const requireRole = vi.fn();
const userUpdate = vi.fn();
const authDelete = vi.fn();

vi.mock("./invite", () => ({
  inviteStaff: (...a: unknown[]) => inviteStaff(...a),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    user: { update: userUpdate },
    authenticator: { delete: authDelete },
  },
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("studio staff actions", () => {
  beforeEach(() => {
    inviteStaff.mockReset().mockResolvedValue({ token: "t", url: "u" });
    revalidatePath.mockReset();
    requireRole.mockReset().mockResolvedValue({ id: "o", role: "OWNER" });
    userUpdate.mockReset().mockResolvedValue({});
    authDelete.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.resetModules());

  it("inviteStaffAction mints + sends an invite (owner-gated)", async () => {
    const { inviteStaffAction } = await import("./actions");
    await inviteStaffAction(
      fd({ email: "x@y.z", role: "ARTIST", displayName: "X" }),
    );
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(inviteStaff).toHaveBeenCalledWith({
      email: "x@y.z",
      role: "ARTIST",
      displayName: "X",
    });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("setRoleAction updates the user's role", async () => {
    const { setRoleAction } = await import("./actions");
    await setRoleAction(fd({ id: "u1", role: "OWNER" }));
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { role: "OWNER" },
    });
  });

  it("setActiveAction toggles the active flag", async () => {
    const { setActiveAction } = await import("./actions");
    await setActiveAction(fd({ id: "u1", active: "false" }));
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { active: false },
    });
  });

  it("removePasskeyAction deletes the authenticator", async () => {
    const { removePasskeyAction } = await import("./actions");
    await removePasskeyAction(fd({ credentialId: "c1" }));
    expect(authDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
