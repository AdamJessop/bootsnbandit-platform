import { describe, expect, it } from "vitest";
import { buildArtistCalendar, type FeedBooking } from "./ical";

/**
 * Unit tests for the iCal feed builder. Pure (no DB): given an artist name and
 * a list of bookings, it emits a valid VCALENDAR with one VEVENT per booking.
 */

const bookings: FeedBooking[] = [
  {
    id: "bk1",
    type: "session",
    start: new Date("2099-08-01T10:00:00Z"),
    end: new Date("2099-08-01T12:00:00Z"),
    status: "confirmed",
    customerFirstName: "Ada",
    placement: "Forearm",
  },
  {
    id: "bk2",
    type: "consult",
    start: new Date("2099-08-02T14:00:00Z"),
    end: new Date("2099-08-02T14:30:00Z"),
    status: "pending",
    customerFirstName: "Cal",
    placement: null,
  },
];

describe("buildArtistCalendar", () => {
  it("emits a VCALENDAR with a VEVENT per booking", () => {
    const ics = buildArtistCalendar("Marnie", bookings);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    const events = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(events.length).toBe(2);
  });

  it("uses type + customer first name in the summary", () => {
    const ics = buildArtistCalendar("Marnie", bookings);
    expect(ics).toContain("Session");
    expect(ics).toContain("Ada");
  });

  it("is read-only metadata (a named calendar for the artist)", () => {
    const ics = buildArtistCalendar("Marnie", bookings);
    expect(ics).toContain("Marnie");
  });

  it("produces a valid empty calendar when the artist has no bookings", () => {
    const ics = buildArtistCalendar("Marnie", []);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
