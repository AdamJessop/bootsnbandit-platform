import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { reportOverview } from "@/lib/services/reports";
import { ApiError, handleApiError, json, parseQuery } from "../_lib/http";

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
    // Owners see any/all. Non-owners must have an artistId and may only ask
    // for their own figures — fail closed rather than re-scoping silently.
    let scopedArtistId = artistId;
    if (user.role !== "OWNER") {
      if (!user.artistId) throw new ApiError(403, "Forbidden");
      if (artistId && artistId !== user.artistId)
        throw new ApiError(403, "Forbidden");
      scopedArtistId = user.artistId;
    }
    const report = await reportOverview({ from, to, artistId: scopedArtistId });
    return json({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
