import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadArtistsForUser: vi.fn(),
  loadCalendarData: vi.fn(),
  loadCalendarDataAll: vi.fn(),
  loadCustomerOptions: vi.fn(),
  resolveActiveArtist: vi.fn(),
  CalendarClient: vi.fn<(props: Record<string, unknown>) => null>(),
}));

vi.mock("@bnb/core/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./CalendarClient", () => ({ CalendarClient: mocks.CalendarClient }));
vi.mock("./data", () => ({
  loadArtistsForUser: mocks.loadArtistsForUser,
  loadCalendarData: mocks.loadCalendarData,
  loadCalendarDataAll: mocks.loadCalendarDataAll,
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
      {
        id: "a1",
        name: "Artist A",
        hourlyRatePence: 9000,
        dayRatePence: 60000,
      },
    ]);
    mocks.resolveActiveArtist.mockReturnValueOnce("a1");
    mocks.loadCalendarData.mockResolvedValueOnce({ events: [], leave: [] });
    mocks.loadCustomerOptions.mockResolvedValueOnce([]);

    renderToStaticMarkup(
      await CalendarPage({ searchParams: Promise.resolve({}) }),
    );

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

  it("all-staff loads every artist's calendar and forwards hue metadata", async () => {
    mocks.loadCalendarData.mockClear();
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      role: "OWNER",
      artistId: null,
    });
    mocks.loadArtistsForUser.mockResolvedValueOnce([
      { id: "a1", name: "Artist A", hue: "#e11d48" },
      { id: "a2", name: "Artist B", hue: null },
    ]);
    mocks.resolveActiveArtist.mockReturnValueOnce("all");
    const taggedEvents = [
      {
        id: "bk1",
        type: "session",
        title: "Sleeve",
        start: "2026-06-16T12:00:00.000Z",
        end: "2026-06-16T14:00:00.000Z",
        status: "confirmed",
        artistId: "a2",
      },
    ];
    mocks.loadCalendarDataAll.mockResolvedValueOnce({
      events: taggedEvents,
      leave: [],
    });
    mocks.loadCustomerOptions.mockResolvedValueOnce([]);

    renderToStaticMarkup(
      await CalendarPage({
        searchParams: Promise.resolve({ artist: "all" }),
      }),
    );

    expect(mocks.loadCalendarDataAll).toHaveBeenCalledWith(
      ["a1", "a2"],
      expect.any(Date),
      "day",
    );
    expect(mocks.loadCalendarData).not.toHaveBeenCalled();

    const props = mocks.CalendarClient.mock.calls.at(-1)?.[0] as {
      activeArtistId: string;
      artists: Array<{ id: string; hue?: string | null }>;
      events: unknown[];
    };
    expect(props.activeArtistId).toBe("all");
    expect(props.artists[0]).toMatchObject({ id: "a1", hue: "#e11d48" });
    expect(props.artists[1]).toMatchObject({ id: "a2", hue: null });
    expect(props.events).toEqual(taggedEvents);
  });
});
