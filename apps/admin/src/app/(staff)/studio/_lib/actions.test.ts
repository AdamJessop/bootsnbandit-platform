import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const inviteStaff = vi.fn();
const sendInviteEmail = vi.fn();
const findPendingInvite = vi.fn();
const revalidatePath = vi.fn();
const requireRole = vi.fn();
const userUpdate = vi.fn();
const userFindUnique = vi.fn();
const userCount = vi.fn();
const authDelete = vi.fn();
const authFindUnique = vi.fn();
const authCount = vi.fn();
const inviteUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock("./invite", () => ({
  inviteStaff: (...a: unknown[]) => inviteStaff(...a),
  sendInviteEmail: (...a: unknown[]) => sendInviteEmail(...a),
}));
vi.mock("@bnb/core/auth/invite", () => ({
  findPendingInvite: (...a: unknown[]) => findPendingInvite(...a),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    user: { update: userUpdate, findUnique: userFindUnique, count: userCount },
    authenticator: {
      delete: authDelete,
      findUnique: authFindUnique,
      count: authCount,
    },
    staffInvite: { updateMany: inviteUpdateMany },
    $transaction: transaction,
  },
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const EXPIRES = new Date("2026-11-08T09:00:00Z");

describe("studio staff actions", () => {
  beforeEach(() => {
    process.env.INBOUND_EMAIL_DOMAIN = "bootsnbandit.com";
    process.env.EMAIL_FROM = "Boots 'n' Bandit <studio@bootsnbandit.com>";
    inviteStaff.mockReset().mockResolvedValue({
      token: "t",
      email: "x@example.com",
      role: "ARTIST",
      userId: "u9",
      expiresAt: EXPIRES,
      url: "https://admin.example.com/sign-in?invite=t",
      emailed: true,
    });
    sendInviteEmail.mockReset().mockResolvedValue(true);
    findPendingInvite.mockReset();
    revalidatePath.mockReset();
    requireRole.mockReset().mockResolvedValue({ id: "o", role: "OWNER" });
    userUpdate.mockReset().mockResolvedValue({});
    userFindUnique.mockReset().mockResolvedValue(null);
    userCount.mockReset().mockResolvedValue(2);
    authDelete.mockReset().mockResolvedValue({});
    authFindUnique.mockReset();
    authCount.mockReset().mockResolvedValue(2);
    inviteUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    transaction.mockReset().mockResolvedValue([]);
  });
  afterEach(() => {
    vi.resetModules();
    delete process.env.INBOUND_EMAIL_DOMAIN;
    delete process.env.EMAIL_FROM;
  });

  describe("inviteStaffAction", () => {
    it("mints + sends an invite (owner-gated) and returns the link", async () => {
      const { inviteStaffAction } = await import("./actions");
      const res = await inviteStaffAction(
        fd({ email: " X@Example.com ", role: "ARTIST", displayName: "X" }),
      );
      expect(requireRole).toHaveBeenCalledWith("OWNER");
      expect(inviteStaff).toHaveBeenCalledWith({
        email: "x@example.com",
        role: "ARTIST",
        displayName: "X",
      });
      expect(revalidatePath).toHaveBeenCalled();
      expect(res).toEqual({
        ok: true,
        email: "x@example.com",
        inviteUrl: "https://admin.example.com/sign-in?invite=t",
        expiresAt: EXPIRES.toISOString(),
        emailed: true,
      });
    });

    it("reports emailed: false when the email didn't go out (link still returned)", async () => {
      inviteStaff.mockResolvedValueOnce({
        token: "t",
        email: "x@example.com",
        role: "ARTIST",
        userId: "u9",
        expiresAt: EXPIRES,
        url: "https://admin.example.com/sign-in?invite=t",
        emailed: false,
      });
      const { inviteStaffAction } = await import("./actions");
      const res = await inviteStaffAction(fd({ email: "x@example.com" }));
      expect(res).toMatchObject({
        ok: true,
        emailed: false,
        inviteUrl: "https://admin.example.com/sign-in?invite=t",
      });
    });

    it("passes no role when the owner left it on 'keep current' (no silent demotion)", async () => {
      const { inviteStaffAction } = await import("./actions");
      await inviteStaffAction(fd({ email: "sarah@example.com", role: "" }));
      expect(inviteStaff.mock.calls[0][0]).toMatchObject({ role: undefined });
    });

    it("refuses an address at our own inbound domain", async () => {
      const { inviteStaffAction } = await import("./actions");
      const res = await inviteStaffAction(
        fd({ email: "calum@bootsnbandit.com", role: "OWNER" }),
      );
      expect(res).toEqual({
        ok: false,
        emailed: false,
        error:
          "Mail to @bootsnbandit.com goes to the enquiry inbox — invite their personal email.",
      });
      expect(inviteStaff).not.toHaveBeenCalled();
    });

    it("rejects an empty or malformed email without minting", async () => {
      const { inviteStaffAction } = await import("./actions");
      expect(await inviteStaffAction(fd({ email: "" }))).toMatchObject({
        ok: false,
      });
      expect(await inviteStaffAction(fd({ email: "nope" }))).toMatchObject({
        ok: false,
      });
      expect(inviteStaff).not.toHaveBeenCalled();
    });

    it("turns a mint failure into an inline error", async () => {
      inviteStaff.mockRejectedValueOnce(new Error("db down"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { inviteStaffAction } = await import("./actions");
      const res = await inviteStaffAction(fd({ email: "x@example.com" }));
      spy.mockRestore();
      expect(res).toMatchObject({ ok: false, emailed: false });
    });
  });

  describe("resendInviteAction", () => {
    it("re-sends the email for a pending invite", async () => {
      findPendingInvite.mockResolvedValue({
        id: "i1",
        email: "x@example.com",
        role: "ARTIST",
        userId: "u9",
        expiresAt: EXPIRES,
        url: "https://admin.example.com/sign-in?invite=t",
      });
      userFindUnique.mockResolvedValue({ displayName: "X" });
      const { resendInviteAction } = await import("./actions");
      const res = await resendInviteAction(fd({ id: "i1" }));
      expect(sendInviteEmail).toHaveBeenCalledWith({
        email: "x@example.com",
        url: "https://admin.example.com/sign-in?invite=t",
        role: "ARTIST",
        expiresAt: EXPIRES,
        inviteeName: "X",
      });
      expect(res).toMatchObject({ ok: true, emailed: true });
    });

    it("refuses an expired or used invite", async () => {
      findPendingInvite.mockResolvedValue(null);
      const { resendInviteAction } = await import("./actions");
      const res = await resendInviteAction(fd({ id: "i1" }));
      expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
      expect(sendInviteEmail).not.toHaveBeenCalled();
    });
  });

  describe("setRoleAction", () => {
    it("updates the user's role", async () => {
      userFindUnique.mockResolvedValue({ role: "ARTIST", active: true });
      const { setRoleAction } = await import("./actions");
      const res = await setRoleAction(fd({ id: "u1", role: "OWNER" }));
      expect(res).toEqual({ ok: true });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { role: "OWNER" },
      });
    });

    it("demotes an owner while another active owner remains", async () => {
      userFindUnique.mockResolvedValue({ role: "OWNER", active: true });
      userCount.mockResolvedValue(2);
      const { setRoleAction } = await import("./actions");
      expect(await setRoleAction(fd({ id: "u1", role: "ARTIST" }))).toEqual({
        ok: true,
      });
    });

    it("refuses to demote the last active owner", async () => {
      userFindUnique.mockResolvedValue({ role: "OWNER", active: true });
      userCount.mockResolvedValue(1);
      const { setRoleAction } = await import("./actions");
      const res = await setRoleAction(fd({ id: "u1", role: "ARTIST" }));
      expect(res).toMatchObject({
        ok: false,
        error: expect.stringMatching(/last active owner/),
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("refuses an owner demoting themselves", async () => {
      userFindUnique.mockResolvedValue({ role: "OWNER", active: true });
      const { setRoleAction } = await import("./actions");
      const res = await setRoleAction(fd({ id: "o", role: "ARTIST" }));
      expect(res).toMatchObject({
        ok: false,
        error: expect.stringMatching(/your own owner role/),
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });
  });

  describe("setActiveAction", () => {
    it("toggles the active flag", async () => {
      userFindUnique.mockResolvedValue({ role: "ARTIST", active: true });
      const { setActiveAction } = await import("./actions");
      const res = await setActiveAction(fd({ id: "u1", active: "false" }));
      expect(res).toEqual({ ok: true });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { active: false },
      });
    });

    it("re-enables without any guard lookups", async () => {
      const { setActiveAction } = await import("./actions");
      await setActiveAction(fd({ id: "u1", active: "true" }));
      expect(userFindUnique).not.toHaveBeenCalled();
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { active: true },
      });
    });

    it("refuses an owner disabling themselves", async () => {
      const { setActiveAction } = await import("./actions");
      const res = await setActiveAction(fd({ id: "o", active: "false" }));
      expect(res).toMatchObject({
        ok: false,
        error: expect.stringMatching(/your own account/),
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("refuses to disable the last active owner", async () => {
      userFindUnique.mockResolvedValue({ role: "OWNER", active: true });
      userCount.mockResolvedValue(1);
      const { setActiveAction } = await import("./actions");
      const res = await setActiveAction(fd({ id: "u1", active: "false" }));
      expect(res).toMatchObject({
        ok: false,
        error: expect.stringMatching(/last active owner/),
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });
  });

  describe("removePasskeyAction", () => {
    it("deletes the authenticator", async () => {
      authFindUnique.mockResolvedValue({
        userId: "u1",
        user: { role: "ARTIST", active: true },
      });
      const { removePasskeyAction } = await import("./actions");
      const res = await removePasskeyAction(fd({ credentialId: "c1" }));
      expect(res).toEqual({ ok: true });
      expect(authDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });

    it("allows removing another artist's last passkey (they can be re-invited)", async () => {
      authFindUnique.mockResolvedValue({
        userId: "u1",
        user: { role: "ARTIST", active: true },
      });
      authCount.mockResolvedValue(1);
      const { removePasskeyAction } = await import("./actions");
      expect(await removePasskeyAction(fd({ credentialId: "c1" }))).toEqual({
        ok: true,
      });
    });

    it("refuses removing the last owner's only passkey", async () => {
      authFindUnique.mockResolvedValue({
        userId: "o",
        user: { role: "OWNER", active: true },
      });
      authCount.mockResolvedValue(1);
      userCount.mockResolvedValue(1);
      const { removePasskeyAction } = await import("./actions");
      const res = await removePasskeyAction(fd({ credentialId: "c1" }));
      expect(res).toMatchObject({
        ok: false,
        error: expect.stringMatching(/last owner's only passkey/),
      });
      expect(authDelete).not.toHaveBeenCalled();
    });

    it("refuses removing your own only passkey even with other owners", async () => {
      authFindUnique.mockResolvedValue({
        userId: "o",
        user: { role: "OWNER", active: true },
      });
      authCount.mockResolvedValue(1);
      userCount.mockResolvedValue(2);
      const { removePasskeyAction } = await import("./actions");
      const res = await removePasskeyAction(fd({ credentialId: "c1" }));
      expect(res).toMatchObject({
        ok: false,
        error: expect.stringMatching(/your only passkey/),
      });
      expect(authDelete).not.toHaveBeenCalled();
    });

    it("says so when the passkey is already gone", async () => {
      authFindUnique.mockResolvedValue(null);
      const { removePasskeyAction } = await import("./actions");
      expect(
        await removePasskeyAction(fd({ credentialId: "c1" })),
      ).toMatchObject({ ok: false });
    });
  });

  describe("updateStaffDetailsAction", () => {
    it("updates email + display name and moves pending invites with the user", async () => {
      const { updateStaffDetailsAction } = await import("./actions");
      const res = await updateStaffDetailsAction(
        fd({ id: "u1", email: " Calum@Example.com ", displayName: " Calum " }),
      );
      expect(res).toEqual({ ok: true });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { email: "calum@example.com", displayName: "Calum" },
      });
      expect(inviteUpdateMany).toHaveBeenCalledWith({
        where: { userId: "u1", redeemedAt: null },
        data: { email: "calum@example.com" },
      });
      expect(transaction).toHaveBeenCalledOnce();
      expect(revalidatePath).toHaveBeenCalled();
    });

    it("keeps the same email when only the name changes", async () => {
      userFindUnique.mockResolvedValue({ id: "u1" });
      const { updateStaffDetailsAction } = await import("./actions");
      const res = await updateStaffDetailsAction(
        fd({ id: "u1", email: "calum@example.com", displayName: "Cal" }),
      );
      expect(res).toEqual({ ok: true });
    });

    it("refuses an email another account already uses", async () => {
      userFindUnique.mockResolvedValue({ id: "u2" });
      const { updateStaffDetailsAction } = await import("./actions");
      const res = await updateStaffDetailsAction(
        fd({ id: "u1", email: "sarah@example.com", displayName: "Calum" }),
      );
      expect(res).toEqual({
        ok: false,
        error: "Another account already uses that email.",
      });
      expect(transaction).not.toHaveBeenCalled();
    });

    it("maps a unique-index race to the same inline error", async () => {
      transaction.mockRejectedValueOnce(
        Object.assign(new Error("unique"), { code: "P2002" }),
      );
      const { updateStaffDetailsAction } = await import("./actions");
      const res = await updateStaffDetailsAction(
        fd({ id: "u1", email: "calum@example.com", displayName: "Calum" }),
      );
      expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/already uses/) });
    });

    it("validates format, our own domain and a non-empty name", async () => {
      const { updateStaffDetailsAction } = await import("./actions");
      expect(
        await updateStaffDetailsAction(
          fd({ id: "u1", email: "calum@fake", displayName: "Calum" }),
        ),
      ).toMatchObject({ ok: false, error: expect.stringMatching(/look like/) });
      expect(
        await updateStaffDetailsAction(
          fd({ id: "u1", email: "calum@bootsnbandit.com", displayName: "Calum" }),
        ),
      ).toMatchObject({ ok: false, error: expect.stringMatching(/enquiry inbox/) });
      expect(
        await updateStaffDetailsAction(
          fd({ id: "u1", email: "calum@example.com", displayName: "  " }),
        ),
      ).toMatchObject({ ok: false, error: expect.stringMatching(/name/) });
      expect(transaction).not.toHaveBeenCalled();
    });
  });
});
