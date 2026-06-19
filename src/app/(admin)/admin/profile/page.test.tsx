import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "sarah@studio.test",
    displayName: "Sarah",
    role: "ARTIST",
    artistId: "art1",
  })),
}));
vi.mock("@bnb/core/auth/config", () => ({
  getAuthConfig: () => ({ origin: "http://localhost:3000" }),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    artist: {
      findUnique: vi.fn(async () => ({
        id: "art1",
        status: "CO_OWNER",
        bio: "Heritage tattooer",
        insta: "@sarah",
        headshot: null,
        hourlyRatePence: 9000,
        dayRatePence: 60000,
        specials: [],
        styles: [{ id: "s1" }],
      })),
    },
    tattooStyle: {
      findMany: vi.fn(async () => [
        { id: "s1", name: "Fine-line" },
        { id: "s2", name: "Bold" },
      ]),
    },
    calendarFeed: {
      findUnique: vi.fn(async () => ({ token: "FEEDTOKEN" })),
    },
    authenticator: {
      findMany: vi.fn(async () => [
        { id: "p1", deviceName: "MacBook", createdAt: new Date("2026-01-01") },
      ]),
    },
  },
}));
vi.mock("./_lib/actions", () => ({
  saveProfile: vi.fn(),
  regenerateFeed: vi.fn(),
  removeOwnPasskey: vi.fn(),
}));

describe("ProfilePage", () => {
  it("shows the iCal subscribe URL, profile editor and passkeys", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Sarah");
    expect(html).toContain("http://localhost:3000/api/calendar/FEEDTOKEN.ics");
    expect(html).toContain("Regenerate URL");
    expect(html).toContain("MacBook");
    expect(html).toContain("Heritage tattooer");
    expect(html).toContain("Fine-line");
  });
});
