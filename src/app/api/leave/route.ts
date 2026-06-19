import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createLeave, listLeave } from "@/lib/services/leave";
import { handleApiError, json, parseBody, parseQuery } from "../_lib/http";

/**
 * /api/leave (admin) — declare + list artist leave. Approved leave blocks
 * bookings (see bookings.checkConflict). Requires a signed-in user.
 */

const createSchema = z.object({
  artistId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().nullish(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole();
    const input = await parseBody(req, createSchema);
    const leave = await createLeave(input);
    return json({ leave }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

const listSchema = z.object({
  artistId: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole();
    const query = parseQuery(req.url, listSchema);
    const leave = await listLeave(query);
    return json({ leave });
  } catch (err) {
    return handleApiError(err);
  }
}
