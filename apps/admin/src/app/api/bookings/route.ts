import { z } from "zod";
import { requireRole } from "@bnb/core/auth";
import {
  createBooking,
  listBookings,
  type CreateBookingInput,
} from "@bnb/core/services/bookings";
import {
  ApiError,
  handleApiError,
  json,
  parseBody,
  parseQuery,
} from "@bnb/core/http";

/**
 * /api/bookings (admin). Requires a signed-in staff user.
 * POST runs the leave-aware conflict check (overlap → 409).
 */

const createSchema = z.object({
  customerId: z.string().min(1),
  artistId: z.string().min(1),
  enquiryId: z.string().nullish(),
  type: z.enum(["consult", "session", "flash"]),
  style: z.string().nullish(),
  placement: z.string().nullish(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  durationMin: z.number().int().positive(),
  priceEstimatePence: z.number().int().nonnegative().nullish(),
  depositPence: z.number().int().nonnegative().nullish(),
  status: z
    .enum([
      "enquiry",
      "pending",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
    ])
    .optional(),
  notes: z.string().nullish(),
  remindersOptIn: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const input = await parseBody(req, createSchema);
    // Owner-or-self: artists may only create bookings for themselves.
    if (user.role !== "OWNER" && input.artistId !== user.artistId) {
      throw new ApiError(403, "Forbidden");
    }
    const booking = await createBooking(input as CreateBookingInput);
    return json({ booking }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

const listSchema = z.object({
  artistId: z.string().optional(),
  customerId: z.string().optional(),
  status: z
    .enum([
      "enquiry",
      "pending",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
    ])
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const query = parseQuery(req.url, listSchema);
    // Non-owners are always self-scoped: ignore any requested artistId.
    if (user.role !== "OWNER") {
      query.artistId = user.artistId ?? undefined;
    }
    const bookings = await listBookings(query);
    return json({ bookings });
  } catch (err) {
    return handleApiError(err);
  }
}
