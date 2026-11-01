import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const requireRole = vi.fn(async () => ({ id: "o1", role: "OWNER" }));

vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...(a as [])),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: { review: { count: vi.fn(async () => 2) } },
}));
vi.mock("@bnb/core/services/reviews", () => ({
  listReviewsForModeration: vi.fn(async () => [
    {
      id: "r1",
      status: "submitted",
      rating: 5,
      body: "Brilliant from start to finish",
      customerName: "Hannah M",
      artistName: "Calum",
      submittedAt: new Date("2026-10-12T15:00:00Z"),
    },
  ]),
}));
vi.mock("./actions", () => ({ moderateReviewAction: vi.fn() }));

describe("ReviewsContentPage", () => {
  it("is owner-only and lists reviews awaiting moderation", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(html).toContain("Reviews");
    expect(html).toContain("Hannah M");
    expect(html).toContain("Brilliant from start to finish");
    expect(html).toContain("12 Oct 2026");
    expect(html).toContain(
      "2 more requests are still waiting on the customer.",
    );
  });
});
