import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests the staff-invite orchestration: mint a StaffInvite token, then send the
 * invite email via the email service with the redeem URL. Both dependencies are
 * mocked so no DB or Resend call is made.
 */

vi.mock("server-only", () => ({}));

const mintStaffInvite = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/auth/invite", () => ({
  mintStaffInvite: (...a: unknown[]) => mintStaffInvite(...a),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));

async function load() {
  return import("./invite");
}

describe("inviteStaff", () => {
  beforeEach(() => {
    mintStaffInvite.mockReset();
    sendEmail.mockReset();
    mintStaffInvite.mockResolvedValue({
      token: "tok123",
      email: "new@studio.test",
      role: "ARTIST",
      userId: "u1",
      expiresAt: new Date("2026-07-01"),
      url: "http://localhost:3000/sign-in?invite=tok123",
    });
    sendEmail.mockResolvedValue({ id: "m1", status: "skipped" });
  });

  afterEach(() => vi.resetModules());

  it("mints an invite with the given email + role", async () => {
    const { inviteStaff } = await load();
    await inviteStaff({ email: "new@studio.test", role: "OWNER" });
    expect(mintStaffInvite).toHaveBeenCalledWith({
      email: "new@studio.test",
      role: "OWNER",
      displayName: undefined,
    });
  });

  it("sends a dedicated staff_invite email to the invitee with the redeem URL", async () => {
    const { inviteStaff } = await load();
    await inviteStaff({ email: "new@studio.test" });
    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0] as {
      to: string;
      type: string;
      data: { url: string };
    };
    expect(arg.to).toBe("new@studio.test");
    expect(arg.type).toBe("staff_invite");
    expect(arg.data.url).toContain("invite=tok123");
  });

  it("returns the minted invite token + url", async () => {
    const { inviteStaff } = await load();
    const res = await inviteStaff({ email: "new@studio.test" });
    expect(res.token).toBe("tok123");
    expect(res.url).toContain("invite=tok123");
  });
});
