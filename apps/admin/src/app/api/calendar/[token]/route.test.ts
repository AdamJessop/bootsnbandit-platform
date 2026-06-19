import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for GET /api/calendar/[token].ics. The prisma client is mocked so
 * these run without a database. The unguessable token IS the auth — a missing
 * or inactive feed returns 404; a valid one returns a text/calendar body.
 */

const feedFindFirst = vi.fn();
const bookingFindMany = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: {
    calendarFeed: {
      findFirst: (...a: unknown[]) => feedFindFirst(...a),
    },
    booking: {
      findMany: (...a: unknown[]) => bookingFindMany(...a),
    },
  },
}));

import { GET } from "./route";

function ctx(token: string) {
  return { params: Promise.resolve({ token }) };
}

afterEach(() => {
  feedFindFirst.mockReset();
  bookingFindMany.mockReset();
});

describe("GET /api/calendar/[token].ics", () => {
  it("404s for an unknown/inactive token", async () => {
    feedFindFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/calendar/bad.ics"), ctx("bad.ics"));
    expect(res.status).toBe(404);
    // The .ics suffix must be stripped before the lookup.
    expect(feedFindFirst).toHaveBeenCalledWith({
      where: { token: "bad", active: true },
      include: { artist: true },
    });
  });

  it("returns a text/calendar VCALENDAR with an event for a seeded booking", async () => {
    feedFindFirst.mockResolvedValue({
      token: "good",
      active: true,
      artistId: "a1",
      artist: { name: "Marnie" },
    });
    bookingFindMany.mockResolvedValue([
      {
        id: "bk1",
        type: "session",
        start: new Date("2099-08-01T10:00:00Z"),
        end: new Date("2099-08-01T12:00:00Z"),
        status: "confirmed",
        placement: "Forearm",
        customer: { name: "Ada Lovelace" },
      },
    ]);

    const res = await GET(
      new Request("http://x/api/calendar/good.ics"),
      ctx("good.ics"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("Ada");

    // Cancelled / no_show must be excluded by the query filter.
    const arg = bookingFindMany.mock.calls[0][0] as {
      where: { status: { in: string[] }; artistId: string };
    };
    expect(arg.where.artistId).toBe("a1");
    expect(arg.where.status.in).not.toContain("cancelled");
    expect(arg.where.status.in).not.toContain("no_show");
  });
});
