import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  listAvailabilityRules,
  setAvailabilityRules,
} from "@/lib/services/availability";
import {
  ApiError,
  handleApiError,
  json,
  parseBody,
  parseQuery,
} from "../_lib/http";

/**
 * /api/availability (admin) — read + replace an artist's weekly pattern.
 */

const getSchema = z.object({ artistId: z.string().min(1) });

export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const { artistId } = parseQuery(req.url, getSchema);
    // Owner-or-self: artists may only touch their own pattern.
    if (user.role !== "OWNER" && user.artistId !== artistId) {
      throw new ApiError(403, "Forbidden");
    }
    const rules = await listAvailabilityRules(artistId);
    return json({ rules });
  } catch (err) {
    return handleApiError(err);
  }
}

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const putSchema = z.object({
  artistId: z.string().min(1),
  rules: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startTime: hhmm,
      endTime: hhmm,
    }),
  ),
});

export async function PUT(req: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const { artistId, rules } = await parseBody(req, putSchema);
    // Owner-or-self: artists may only touch their own pattern.
    if (user.role !== "OWNER" && user.artistId !== artistId) {
      throw new ApiError(403, "Forbidden");
    }
    const saved = await setAvailabilityRules(artistId, rules);
    return json({ rules: saved });
  } catch (err) {
    return handleApiError(err);
  }
}
