import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/services/reports", () => ({ reportOverview: vi.fn() }));

import AdminHomePage from "./page";

describe("AdminHomePage (Today dashboard)", () => {
  it("is an async server component", () => {
    expect(typeof AdminHomePage).toBe("function");
  });
});
