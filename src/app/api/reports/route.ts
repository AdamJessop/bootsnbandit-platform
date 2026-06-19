import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { reportOverview } from "@/lib/services/reports";
import { handleApiError, json, parseQuery } from "../_lib/http";

/**
 * GET /api/reports (admin) — bookings/capacity/revenue overview for a date
 * range, optionally scoped to one artist. Owners see all; artists self-scope
 * (the caller passes their own artistId). Requires a signed-in user.
 */

const schema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  artistId: z.string().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const { from, to, artistId } = parseQuery(req.url, schema);
    // Artists may only see their own figures; owners see any/all.
    const scopedArtistId =
      user.role === "OWNER" ? artistId : (user.artistId ?? undefined);
    const report = await reportOverview({ from, to, artistId: scopedArtistId });
    return json({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
