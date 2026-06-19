import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./CalendarClient", () => ({ CalendarClient: () => null }));
vi.mock("./data", () => ({
  loadArtistsForUser: vi.fn(),
  loadCalendarData: vi.fn(),
  loadCustomerOptions: vi.fn(),
  resolveActiveArtist: vi.fn(),
}));

import CalendarPage from "./page";

describe("CalendarPage", () => {
  it("is an async server component", () => {
    expect(typeof CalendarPage).toBe("function");
  });
});
