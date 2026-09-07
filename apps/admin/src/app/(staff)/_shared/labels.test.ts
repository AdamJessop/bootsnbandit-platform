import { describe, expect, it } from "vitest";
import {
  bookingStatusLabel,
  deriveVisits,
  enquiryStatusLabel,
  formatDateTime,
  formatDay,
  loyaltyTierLabel,
} from "./labels";

describe("status labels", () => {
  it("humanises booking statuses", () => {
    expect(bookingStatusLabel("no_show")).toBe("No-show");
    expect(bookingStatusLabel("confirmed")).toBe("Confirmed");
  });

  it("humanises enquiry statuses", () => {
    expect(enquiryStatusLabel("new")).toBe("New");
    expect(enquiryStatusLabel("converted")).toBe("Converted");
    expect(enquiryStatusLabel("customer_replied")).toBe("Customer replied");
  });
});

describe("loyaltyTierLabel", () => {
  it("labels tier 0 as no tier", () => {
    expect(loyaltyTierLabel(0)).toBe("—");
    expect(loyaltyTierLabel(2)).toBe("Tier 2");
  });
});

describe("deriveVisits", () => {
  const now = new Date("2026-06-19T00:00:00Z").getTime();

  it("picks the most recent past and soonest future booking", () => {
    const r = deriveVisits(
      [
        "2026-01-01T00:00:00Z",
        "2026-05-01T00:00:00Z",
        "2026-08-01T00:00:00Z",
        "2026-12-01T00:00:00Z",
      ],
      now,
    );
    expect(r.lastVisit).toBe("2026-05-01T00:00:00.000Z");
    expect(r.nextVisit).toBe("2026-08-01T00:00:00.000Z");
  });

  it("returns nulls when there are no bookings", () => {
    expect(deriveVisits([], now)).toEqual({ lastVisit: null, nextVisit: null });
  });
});

describe("date formatting", () => {
  it("formats a day and datetime without throwing", () => {
    const iso = "2026-06-19T14:30:00Z";
    expect(formatDay(iso)).toMatch(/2026/);
    expect(formatDateTime(iso)).toMatch(/2026/);
  });

  it("returns a dash for null", () => {
    expect(formatDay(null)).toBe("—");
    expect(formatDateTime(null)).toBe("—");
  });
});
