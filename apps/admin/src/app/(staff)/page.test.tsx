import { describe, expect, it, vi } from "vitest";

vi.mock("@bnb/core/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@bnb/core/db", () => ({ prisma: {} }));
vi.mock("@bnb/core/services/reports", () => ({ reportOverview: vi.fn() }));
vi.mock("@bnb/core/services/reviews", () => ({
  countReviewsAwaitingModeration: vi.fn(),
}));

import AdminHomePage from "./page";

describe("AdminHomePage (Today dashboard)", () => {
  it("is an async server component", () => {
    expect(typeof AdminHomePage).toBe("function");
  });
});
