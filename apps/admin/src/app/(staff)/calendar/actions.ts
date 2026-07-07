"use server";

import { requireRole } from "@bnb/core/auth";
import {
  BookingConflictError,
  createBooking,
  updateBooking,
  type CreateBookingInput,
} from "@bnb/core/services/bookings";

/**
 * Server actions for the calendar/front-desk surfaces (Phase 9). These persist
 * booking create/move/edit by calling the Phase-6 booking service directly.
 * RBAC: any signed-in staff member may CREATE a booking for any artist (the
 * front-desk promise — whoever answers the phone books it in), while
 * update/move stay owner-or-self. Conflicts (overlapping booking or approved
 * leave) surface a friendly message the client can toast.
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

export interface SaveBookingInput extends Omit<
  CreateBookingInput,
  "start" | "end"
> {
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
    const booking = await createBooking({
      ...input,
      start: new Date(input.start),
      end: new Date(input.end),
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
