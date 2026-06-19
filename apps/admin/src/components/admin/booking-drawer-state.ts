/**
 * BookingDrawer state seeding (split out of the component so it is unit-testable
 * without a DOM). Maps an existing booking / clicked slot into the editable
 * BookingFormState consumed by the tested ./booking-form helpers.
 */

import type {
  BookingFormState,
  BookingStatus,
  BookingType,
} from "./booking-form";

/** Existing booking when editing; omit to create. */
export interface BookingDraft {
  id?: string;
  customerId?: string;
  artistId?: string;
  type?: BookingType;
  style?: string;
  placement?: string;
  /** ISO start; supplied by click-empty-slot or an existing block. */
  start?: string;
  durationMins?: number;
  priceEstimate?: number; // pence
  notes?: string;
  status?: BookingStatus;
}

/** Split an ISO timestamp (or now) into local date + time form values. */
export function toLocalParts(iso?: string): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Build the initial editable state from an optional booking + default artist. */
export function initialState(
  booking: BookingDraft | undefined,
  defaultArtistId: string | undefined,
): BookingFormState {
  const { date, time } = toLocalParts(booking?.start);
  return {
    customerId: booking?.customerId ?? "",
    artistId: booking?.artistId ?? defaultArtistId ?? "",
    type: booking?.type ?? "session",
    style: booking?.style ?? "",
    placement: booking?.placement ?? "",
    date,
    time,
    durationMins: booking?.durationMins ?? 90,
    priceEstimatePounds:
      booking?.priceEstimate != null
        ? (booking.priceEstimate / 100).toFixed(2)
        : "",
    notes: booking?.notes ?? "",
    status: booking?.status ?? "pending",
  };
}
