import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@bnb/core/db", () => ({
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

  it("marks Google Calendar as Planned, with no dead-end Connect button", async () => {
    delete process.env.RESEND_API_KEY;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Google Calendar");
    expect(html).toContain("Planned");
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("Connect Google Calendar");
    expect(html).not.toContain("/api/integrations/google");
  });
});
