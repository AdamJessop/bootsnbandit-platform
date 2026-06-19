import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async () => [
        {
          id: "u1",
          email: "sarah@studio.test",
          displayName: "Sarah",
          role: "OWNER",
          active: true,
          authenticators: [
            { id: "p1", deviceName: "MacBook", createdAt: new Date("2026-01-01") },
          ],
        },
      ]),
    },
  },
}));
vi.mock("../_lib/actions", () => ({
  inviteStaffAction: vi.fn(),
  removePasskeyAction: vi.fn(),
  setActiveAction: vi.fn(),
  setRoleAction: vi.fn(),
}));

describe("StaffPage", () => {
  it("renders the staff manager with the roster", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Staff");
    expect(html).toContain("sarah@studio.test");
    expect(html).toContain("Invite staff");
  });
});
