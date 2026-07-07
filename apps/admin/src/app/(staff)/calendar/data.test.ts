import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listBookings: vi.fn(),
  listLeave: vi.fn(),
  customerFindMany: vi.fn(),
  artistFindMany: vi.fn(),
}));

vi.mock("@bnb/core/services/bookings", () => ({
  listBookings: mocks.listBookings,
}));
vi.mock("@bnb/core/services/leave", () => ({ listLeave: mocks.listLeave }));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    customer: { findMany: mocks.customerFindMany },
    artist: { findMany: mocks.artistFindMany },
  },
}));

import {
  loadCalendarDataAll,
  resolveActiveArtist,
  type ArtistLite,
} from "./data";
import type { SessionUser } from "@bnb/core/auth";

const artists: ArtistLite[] = [
  {
    id: "a1",
    name: "Boots",
    hue: null,
    booksStatus: "open",
    hourlyRatePence: 9000,
    dayRatePence: 55000,
  },
  {
    id: "a2",
    name: "Bandit",
    hue: null,
    booksStatus: "open",
    hourlyRatePence: null,
    dayRatePence: null,
  },
];

const owner: SessionUser = {
  id: "u1",
  email: "o@x.com",
  role: "OWNER",
  displayName: "Owner",
  artistId: null,
};
const artist: SessionUser = {
  id: "u2",
  email: "a@x.com",
  role: "ARTIST",
  displayName: "Artist",
  artistId: "a2",
};

describe("resolveActiveArtist", () => {
  it("owner honours a valid requested artist", () => {
    expect(resolveActiveArtist(owner, artists, "a2")).toBe("a2");
  });

  it("owner falls back to the first artist when request is invalid", () => {
    expect(resolveActiveArtist(owner, artists, "nope")).toBe("a1");
    expect(resolveActiveArtist(owner, artists)).toBe("a1");
  });

  it("artist is pinned to their own artistId regardless of request", () => {
    expect(resolveActiveArtist(artist, artists, "a1")).toBe("a2");
  });
});

describe("loadCalendarDataAll", () => {
  const anchor = new Date(2026, 5, 16); // Tue 16 Jun 2026

  const bookingsByArtist: Record<string, unknown[]> = {
    a1: [
      {
        id: "bk1",
        type: "session",
        style: "Sleeve",
        start: new Date(2026, 5, 16, 12),
        end: new Date(2026, 5, 16, 14),
        status: "confirmed",
        customerId: "cus_1",
      },
    ],
    a2: [
      {
        id: "bk2",
        type: "consult",
        style: null,
        start: new Date(2026, 5, 16, 11),
        end: new Date(2026, 5, 16, 11, 30),
        status: "pending",
        customerId: "cus_2",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listBookings.mockImplementation(
      async ({ artistId }: { artistId: string }) =>
        bookingsByArtist[artistId] ?? [],
    );
    mocks.listLeave.mockImplementation(
      async ({ artistId }: { artistId: string }) =>
        artistId === "a2"
          ? [
              {
                startDate: new Date(2026, 5, 17),
                endDate: new Date(2026, 5, 18),
              },
            ]
          : [],
    );
    mocks.customerFindMany.mockResolvedValue([
      { id: "cus_1", name: "Ida" },
      { id: "cus_2", name: "Rex" },
    ]);
  });

  it("returns events for every requested artist, tagged with artistId", async () => {
    const { events } = await loadCalendarDataAll(["a1", "a2"], anchor, "day");
    expect(events).toHaveLength(2);
    const byId = new Map(events.map((e) => [e.id, e]));
    expect(byId.get("bk1")).toMatchObject({
      artistId: "a1",
      title: "Sleeve",
      customerName: "Ida",
      status: "confirmed",
    });
    expect(byId.get("bk2")).toMatchObject({
      artistId: "a2",
      title: "consult", // style null falls back to type
      customerName: "Rex",
    });
    expect(mocks.listBookings).toHaveBeenCalledTimes(2);
  });

  it("tags leave with the owning artistId", async () => {
    const { leave } = await loadCalendarDataAll(["a1", "a2"], anchor, "week");
    expect(leave).toHaveLength(1);
    expect(leave[0].artistId).toBe("a2");
    expect(mocks.listLeave).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: "a2", status: "approved" }),
    );
  });

  it("queries the same day/week window shape as the single loader", async () => {
    await loadCalendarDataAll(["a1"], anchor, "week");
    const call = mocks.listBookings.mock.calls[0][0];
    expect(call.from.getDay()).toBe(0); // week starts Sunday
    expect(call.to.getDay()).toBe(6); // ends Saturday
    await loadCalendarDataAll(["a1"], anchor, "day");
    const dayCall = mocks.listBookings.mock.calls[1][0];
    expect(dayCall.from.getDate()).toBe(16);
    expect(dayCall.to.getDate()).toBe(16);
  });

  it("returns empty sets for no artists without touching the services", async () => {
    const res = await loadCalendarDataAll([], anchor, "day");
    expect(res).toEqual({ events: [], leave: [] });
    expect(mocks.listBookings).not.toHaveBeenCalled();
  });
});
