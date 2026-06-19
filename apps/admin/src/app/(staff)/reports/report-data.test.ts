import { describe, expect, it } from "vitest";
import {
  bookingsByStatusData,
  capacityByArtistData,
  revenueTrendData,
  styleMixData,
  toReportCsv,
  type RawBooking,
} from "./report-data";

const bookings: RawBooking[] = [
  {
    artistName: "Boots",
    status: "completed",
    style: "traditional",
    startISO: "2026-06-01T10:00:00Z",
    revenuePence: 12000,
  },
  {
    artistName: "Boots",
    status: "completed",
    style: "traditional",
    startISO: "2026-06-15T10:00:00Z",
    revenuePence: 8000,
  },
  {
    artistName: "Bandit",
    status: "confirmed",
    style: "fine line",
    startISO: "2026-07-02T10:00:00Z",
    revenuePence: 0,
  },
  {
    artistName: "Bandit",
    status: "cancelled",
    style: null,
    startISO: "2026-07-03T10:00:00Z",
    revenuePence: 0,
  },
];

describe("revenueTrendData", () => {
  it("buckets revenue by month (pounds)", () => {
    const d = revenueTrendData(bookings);
    expect(d).toEqual([
      { label: "2026-06", value: 200 },
      { label: "2026-07", value: 0 },
    ]);
  });
});

describe("bookingsByStatusData", () => {
  it("counts bookings per status", () => {
    const d = bookingsByStatusData(bookings);
    const completed = d.find((x) => x.label === "Completed");
    expect(completed?.value).toBe(2);
    expect(d.find((x) => x.label === "Cancelled")?.value).toBe(1);
  });
});

describe("capacityByArtistData", () => {
  it("emits booked vs capacity per artist", () => {
    const d = capacityByArtistData([
      { artistName: "Boots", bookedMinutes: 120, capacityMinutes: 480 },
    ]);
    expect(d[0]).toEqual({ label: "Boots", value: 120, value2: 480 });
  });
});

describe("styleMixData", () => {
  it("tallies the top styles and ignores null", () => {
    const d = styleMixData(bookings);
    expect(d.find((x) => x.label === "traditional")?.value).toBe(2);
    expect(d.some((x) => x.label === "—")).toBe(false);
  });

  it("caps to five slices", () => {
    const many: RawBooking[] = Array.from({ length: 8 }, (_, i) => ({
      artistName: "A",
      status: "completed",
      style: `s${i}`,
      startISO: "2026-06-01T00:00:00Z",
      revenuePence: 0,
    }));
    expect(styleMixData(many).length).toBeLessThanOrEqual(5);
  });
});

describe("toReportCsv", () => {
  it("builds a per-artist CSV", () => {
    const csv = toReportCsv([
      {
        artistName: "Boots",
        bookings: 3,
        completed: 2,
        revenuePence: 20000,
        utilisationPct: 25,
      },
    ]);
    expect(csv.split("\r\n")[0]).toBe(
      "Artist,Bookings,Completed,Revenue (£),Utilisation %",
    );
    expect(csv).toContain("Boots,3,2,200.00,25");
  });
});
