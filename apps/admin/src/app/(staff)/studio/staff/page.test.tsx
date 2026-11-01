import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@bnb/core/auth/invite", () => ({
  listPendingInvites: vi.fn(async () => [
    {
      id: "i1",
      email: "jess@example.com",
      role: "ARTIST",
      userId: "u2",
      expiresAt: new Date("2026-11-08T09:00:00Z"),
      createdAt: new Date("2026-11-01T09:00:00Z"),
      url: "https://admin.example.com/sign-in?invite=t",
    },
  ]),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async () => [
        {
          id: "u1",
          email: "sarah@example.com",
          displayName: "Sarah",
          role: "OWNER",
          active: true,
          artist: { slug: "sarah", status: "CO_OWNER" },
          authenticators: [
            {
              id: "p1",
              deviceName: "MacBook",
              createdAt: new Date("2026-01-01"),
            },
          ],
        },
      ]),
    },
  },
}));
vi.mock("../_lib/actions", () => ({
  inviteStaffAction: vi.fn(),
  resendInviteAction: vi.fn(),
  removePasskeyAction: vi.fn(),
  setActiveAction: vi.fn(),
  setRoleAction: vi.fn(),
  updateStaffDetailsAction: vi.fn(),
}));

describe("StaffPage", () => {
  it("renders the staff manager with the roster + linked artist status", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Staff");
    expect(html).toContain("sarah@example.com");
    expect(html).toContain("Invite staff");
    expect(html).toContain("Co-owner");
  });

  it("lists pending invites with their link actions", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Pending invites (1)");
    expect(html).toContain("jess@example.com");
    expect(html).toContain("Copy link");
    expect(html).toContain("Resend");
  });
});
