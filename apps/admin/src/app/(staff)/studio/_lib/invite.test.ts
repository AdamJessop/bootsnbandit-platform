import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests the staff-invite orchestration: mint a StaffInvite token, then send the
 * invite email via the email service with the redeem URL, and report whether
 * the email actually went out. Both dependencies are mocked so no DB or Resend
 * call is made.
 */

vi.mock("server-only", () => ({}));

const mintStaffInvite = vi.fn();
const sendEmail = vi.fn();

vi.mock("@bnb/core/auth/invite", () => ({
  mintStaffInvite: (...a: unknown[]) => mintStaffInvite(...a),
}));
vi.mock("@bnb/core/email", () => ({
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
      email: "new@example.com",
      role: "ARTIST",
      userId: "u1",
      expiresAt: new Date("2026-07-01"),
      url: "http://localhost:3000/sign-in?invite=tok123",
    });
    sendEmail.mockResolvedValue({ id: "m1", status: "sent" });
  });

  afterEach(() => vi.resetModules());

  it("mints an invite with the given email + role", async () => {
    const { inviteStaff } = await load();
    await inviteStaff({ email: "new@example.com", role: "OWNER" });
    expect(mintStaffInvite).toHaveBeenCalledWith({
      email: "new@example.com",
      role: "OWNER",
      displayName: undefined,
    });
  });

  it("sends a dedicated staff_invite email to the invitee with the redeem URL", async () => {
    const { inviteStaff } = await load();
    await inviteStaff({ email: "new@example.com" });
    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0] as {
      to: string;
      type: string;
      data: { url: string };
    };
    expect(arg.to).toBe("new@example.com");
    expect(arg.type).toBe("staff_invite");
    expect(arg.data.url).toContain("invite=tok123");
  });

  it("returns the minted invite token + url, flagged as emailed", async () => {
    const { inviteStaff } = await load();
    const res = await inviteStaff({ email: "new@example.com" });
    expect(res.token).toBe("tok123");
    expect(res.url).toContain("invite=tok123");
    expect(res.emailed).toBe(true);
  });

  it("reports emailed: false when Resend failed (sendEmail swallows the error)", async () => {
    sendEmail.mockResolvedValue({ id: "log1", status: "failed" });
    const { inviteStaff } = await load();
    const res = await inviteStaff({ email: "new@example.com" });
    expect(res.emailed).toBe(false);
    expect(res.url).toContain("invite=tok123");
  });

  it("reports emailed: false when email is log-only (no API key)", async () => {
    sendEmail.mockResolvedValue({ id: "log1", status: "skipped" });
    const { inviteStaff } = await load();
    expect((await inviteStaff({ email: "new@example.com" })).emailed).toBe(
      false,
    );
  });
});
