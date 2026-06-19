import { json } from "../../_lib/http";

/**
 * GET /api/integrations/google — Google Calendar connect STUB (P12).
 *
 * Placeholder for the planned two-way OAuth sync between an artist's studio
 * calendar and their Google Calendar. The real flow will:
 *   1. redirect the artist to Google's OAuth consent (calendar.events scope),
 *   2. store the refresh token against the artist,
 *   3. push studio bookings to Google AND pull external busy times back so the
 *      booking conflict-check is Google-aware.
 * Until then this returns a documented "coming soon" payload.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return json(
    {
      status: "coming_soon",
      provider: "google_calendar",
      sync: "Two-way sync (push studio bookings to Google + pull external busy times)",
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
      note: "OAuth connect is not yet enabled. Per-artist iCal feeds are available today on My Profile.",
    },
    200,
  );
}
