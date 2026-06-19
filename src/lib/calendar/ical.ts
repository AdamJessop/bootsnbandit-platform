import ical, { ICalCalendarMethod } from "ical-generator";
import { appOrigin } from "@/lib/email/templates/theme";

/**
 * Per-artist iCal feed builder (P12). Pure + DB-free: callers fetch the
 * artist's upcoming bookings and pass them here to produce a `text/calendar`
 * VCALENDAR string. Read-only — no RSVP/method that implies write-back.
 */

export interface FeedBooking {
  id: string;
  type: string;
  start: Date;
  end: Date;
  status: string;
  customerFirstName: string | null;
  placement: string | null;
}

/** Title-case a booking type for the event summary (e.g. "session" → "Session"). */
function titleType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Build a VCALENDAR for `artistName` containing one VEVENT per booking.
 * Summary = "<Type> · <customer first name>"; description carries status +
 * placement. The feed is published (read-only) — no two-way sync.
 */
export function buildArtistCalendar(
  artistName: string,
  bookings: FeedBooking[],
): string {
  const cal = ical({
    name: `${artistName} — Boots 'n' Bandit`,
    prodId: { company: "Boots 'n' Bandit", product: "studio", language: "EN" },
    url: appOrigin(),
    method: ICalCalendarMethod.PUBLISH,
  });

  for (const b of bookings) {
    const who = b.customerFirstName?.trim() || "Client";
    const summaryParts = [titleType(b.type), who];
    const descParts = [`Status: ${b.status}`];
    if (b.placement) descParts.push(`Placement: ${b.placement}`);

    cal.createEvent({
      id: b.id,
      start: b.start,
      end: b.end,
      summary: summaryParts.join(" · "),
      description: descParts.join("\n"),
    });
  }

  return cal.toString();
}
