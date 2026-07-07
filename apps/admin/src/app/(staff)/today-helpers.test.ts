import { describe, expect, it } from "vitest";
import {
  artistsBookedToday,
  buildOwnerAlerts,
  pendingSoonWindow,
} from "./today-helpers";

describe("pendingSoonWindow", () => {
  it("spans exactly the next 7 days", () => {
    const now = new Date("2026-07-06T09:00:00Z");
    const { from, to } = pendingSoonWindow(now);
    expect(from.toISOString()).toBe("2026-07-06T09:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-13T09:00:00.000Z");
  });
});

describe("buildOwnerAlerts", () => {
  it("returns no alerts when every count is zero", () => {
    expect(
      buildOwnerAlerts({
        newEnquiries: 0,
        pendingSoon: 0,
        overdueFollowUps: 0,
      }),
    ).toEqual([]);
  });

  it("builds one alert per non-zero count with the right links", () => {
    const alerts = buildOwnerAlerts({
      newEnquiries: 2,
      pendingSoon: 3,
      overdueFollowUps: 1,
    });
    expect(alerts).toEqual([
      { href: "/enquiries", text: "2 new enquiries awaiting reply" },
      {
        href: "/bookings",
        text: "3 unconfirmed bookings starting within 7 days",
      },
      { href: "/sessions", text: "1 overdue review follow-up" },
    ]);
  });

  it("singularises correctly", () => {
    const alerts = buildOwnerAlerts({
      newEnquiries: 1,
      pendingSoon: 1,
      overdueFollowUps: 2,
    });
    expect(alerts[0].text).toBe("1 new enquiry awaiting reply");
    expect(alerts[1].text).toBe("1 unconfirmed booking starting within 7 days");
    expect(alerts[2].text).toBe("2 overdue review follow-ups");
  });

  it("skips zero counts in the middle", () => {
    const alerts = buildOwnerAlerts({
      newEnquiries: 0,
      pendingSoon: 0,
      overdueFollowUps: 4,
    });
    expect(alerts).toEqual([
      { href: "/sessions", text: "4 overdue review follow-ups" },
    ]);
  });
});

describe("artistsBookedToday", () => {
  it("counts only artists with at least one booking", () => {
    expect(
      artistsBookedToday([
        { bookings: [{ id: "b1" }, { id: "b2" }] },
        { bookings: [] },
        { bookings: [{ id: "b3" }] },
      ]),
    ).toBe(2);
  });

  it("returns 0 for an empty artist list", () => {
    expect(artistsBookedToday([])).toBe(0);
  });
});
