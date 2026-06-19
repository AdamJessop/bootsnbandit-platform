import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { completeSession } from "@/lib/services/sessions";
import { handleApiError, json, parseBody } from "../_lib/http";

/**
 * POST /api/sessions (admin) — complete a session.
 * Records the amount (pence), marks the booking completed, sends receipt +
 * aftercare emails and awards a loyalty stamp. Requires a signed-in user.
 */

const schema = z.object({
  bookingId: z.string().min(1),
  amountChargedPence: z.number().int().nonnegative(),
  tipPence: z.number().int().nonnegative().nullish(),
  bankRef: z.string().nullish(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole();
    const input = await parseBody(req, schema);
    const result = await completeSession(input);
    return json(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
