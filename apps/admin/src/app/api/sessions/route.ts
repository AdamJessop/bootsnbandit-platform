import { z } from "zod";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { completeSession } from "@bnb/core/services/sessions";
import { ApiError, handleApiError, json, parseBody } from "@bnb/core/http";

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
    const user = await requireRole();
    const input = await parseBody(req, schema);
    // Owner-or-self: an artist may only complete their own bookings.
    if (user.role !== "OWNER") {
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: input.bookingId },
        select: { artistId: true },
      });
      if (booking.artistId !== user.artistId) {
        throw new ApiError(403, "Forbidden");
      }
    }
    const result = await completeSession(input);
    return json(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
