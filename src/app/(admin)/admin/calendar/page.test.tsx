import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadArtistsForUser: vi.fn(),
  loadCalendarData: vi.fn(),
  loadCustomerOptions: vi.fn(),
  resolveActiveArtist: vi.fn(),
  CalendarClient: vi.fn<(props: Record<string, unknown>) => null>(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./CalendarClient", () => ({ CalendarClient: mocks.CalendarClient }));
vi.mock("./data", () => ({
  loadArtistsForUser: mocks.loadArtistsForUser,
  loadCalendarData: mocks.loadCalendarData,
  loadCustomerOptions: mocks.loadCustomerOptions,
  resolveActiveArtist: mocks.resolveActiveArtist,
}));

import CalendarPage from "./page";

describe("CalendarPage", () => {
  it("is an async server component", () => {
    expect(typeof CalendarPage).toBe("function");
  });

  it("forwards artist hourly/day rates to CalendarClient (drawer price pre-fill)", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      role: "OWNER",
      artistId: "a1",
    });
    mocks.loadArtistsForUser.mockResolvedValueOnce([
      { id: "a1", name: "Artist A", hourlyRatePence: 9000, dayRatePence: 60000 },
    ]);
    mocks.resolveActiveArtist.mockReturnValueOnce("a1");
    mocks.loadCalendarData.mockResolvedValueOnce({ events: [], leave: [] });
    mocks.loadCustomerOptions.mockResolvedValueOnce([]);

    renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({}) }));

    expect(mocks.CalendarClient).toHaveBeenCalled();
    const props = mocks.CalendarClient.mock.calls[0][0] as {
      artists: Array<{
        id: string;
        name: string;
        hourlyRatePence?: number | null;
        dayRatePence?: number | null;
      }>;
    };
    expect(props.artists[0]).toMatchObject({
      id: "a1",
      name: "Artist A",
      hourlyRatePence: 9000,
      dayRatePence: 60000,
    });
  });
});
