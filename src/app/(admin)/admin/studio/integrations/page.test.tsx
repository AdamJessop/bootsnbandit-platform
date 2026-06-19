import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    artist: {
      findMany: vi.fn(async () => [
        { id: "a1", name: "Sarah", calendarFeed: { active: true } },
        { id: "a2", name: "Boots", calendarFeed: null },
      ]),
    },
  },
}));

describe("IntegrationsPage", () => {
  it("renders Resend status and per-artist iCal feed status", async () => {
    delete process.env.RESEND_API_KEY;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Integrations");
    expect(html).toContain("Resend");
    expect(html).toContain("Sarah");
    expect(html).toContain("Feed active");
    expect(html).toContain("No feed yet");
  });

  it("renders the Google Calendar connect stub", async () => {
    delete process.env.RESEND_API_KEY;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Google Calendar");
    expect(html).toContain("Coming soon");
  });
});
