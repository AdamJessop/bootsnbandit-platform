"use server";

import { z } from "zod";
import { requireRole } from "@bnb/core/auth";
import {
  BookingConflictError,
  createBooking,
  updateBooking,
  type CreateBookingInput,
} from "@bnb/core/services/bookings";
import { createCustomerWithWelcome } from "@bnb/core/services/customer-welcome";

/**
 * Server actions for the calendar/front-desk surfaces (Phase 9). These persist
 * booking create/move/edit by calling the Phase-6 booking service directly.
 * RBAC: any signed-in staff member may CREATE a booking for any artist (the
 * front-desk promise — whoever answers the phone books it in), while
 * update/move stay owner-or-self. Conflicts (overlapping booking or approved
 * leave) surface a friendly message the client can toast.
 *
 * Inline new customer: the drawer may send `newCustomer` instead of
 * `customerId`; the customer is created first (welcome email with a
 * set-password link) and the booking is linked to the fresh id. A `confirmed`
 * status then fires the confirmation email inside the bookings service.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  bookingId?: string;
}

function conflictMessage(err: BookingConflictError): string {
  return err.kind === "leave"
    ? "That slot clashes with the artist's leave. Pick another time."
    : "That slot is already booked. Pick another time.";
}

async function assertCanEditArtist(artistId: string): Promise<void> {
  const user = await requireRole();
  if (user.role !== "OWNER" && artistId !== user.artistId) {
    throw new Error("You can only manage your own calendar.");
  }
}

const newCustomerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name."),
  email: z.email("Enter a valid email address."),
  /** "YYYY-MM-DD" from the drawer's date input. */
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth.")
    .optional(),
});

const saveBookingSchema = z
  .object({
    customerId: z.string().min(1).optional(),
    newCustomer: newCustomerSchema.optional(),
    artistId: z.string().min(1),
    enquiryId: z.string().nullish(),
    type: z.enum(["consult", "session", "flash"]),
    style: z.string().nullish(),
    placement: z.string().nullish(),
    start: z.string().min(1),
    end: z.string().min(1),
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
  })
  // Exactly one of customerId / newCustomer.
  .refine((v) => Boolean(v.customerId) !== Boolean(v.newCustomer), {
    message: "Choose an existing customer or add a new one.",
  });

export interface SaveBookingInput extends Omit<
  CreateBookingInput,
  "start" | "end" | "customerId"
> {
  customerId?: string;
  /** Inline new customer — mutually exclusive with `customerId`. */
  newCustomer?: z.infer<typeof newCustomerSchema>;
  start: string;
  end: string;
}

/**
 * Create a booking (drawer create / quick-add). Any active signed-in staff
 * member may create for any artist — front-desk quick-add is a shared duty.
 */
export async function saveBookingAction(
  input: SaveBookingInput,
): Promise<ActionResult> {
  try {
    await requireRole();
    const parsed = saveBookingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Check the booking details.",
      };
    }
    const { newCustomer, customerId, ...rest } = parsed.data;

    let bookingCustomerId = customerId;
    if (newCustomer) {
      const customer = await createCustomerWithWelcome({
        name: newCustomer.name,
        email: newCustomer.email,
        // Date-only string → UTC midnight.
        dob: newCustomer.dob
          ? new Date(`${newCustomer.dob}T00:00:00.000Z`)
          : null,
        siteOrigin: process.env.PUBLIC_SITE_ORIGIN ?? "http://localhost:3000",
      });
      bookingCustomerId = customer.id;
    }

    const booking = await createBooking({
      ...rest,
      customerId: bookingCustomerId as string,
      start: new Date(rest.start),
      end: new Date(rest.end),
    });
    return { ok: true, bookingId: booking.id };
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return { ok: false, error: conflictMessage(err) };
    }
    return { ok: false, error: (err as Error).message ?? "Could not save." };
  }
}

export interface UpdateBookingActionInput {
  id: string;
  artistId: string;
  start?: string;
  end?: string;
  type?: CreateBookingInput["type"];
  style?: string | null;
  placement?: string | null;
  durationMin?: number;
  priceEstimatePence?: number | null;
  notes?: string | null;
  status?: CreateBookingInput["status"];
}

/** Edit / move a booking (drawer edit + drag-to-move persistence). */
export async function updateBookingAction(
  input: UpdateBookingActionInput,
): Promise<ActionResult> {
  try {
    await assertCanEditArtist(input.artistId);
    const { id, ...rest } = input;
    await updateBooking(id, {
      ...rest,
      start: rest.start ? new Date(rest.start) : undefined,
      end: rest.end ? new Date(rest.end) : undefined,
    });
    return { ok: true, bookingId: id };
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return { ok: false, error: conflictMessage(err) };
    }
    return { ok: false, error: (err as Error).message ?? "Could not save." };
  }
}
