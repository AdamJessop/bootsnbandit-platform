"use client";

import { useState, useTransition } from "react";
import { requestCancellationAction } from "./actions";

/**
 * Signed-in customer's bookings: upcoming (with a request-cancellation
 * control) and past. Pure list UI — data is shaped by the passport page.
 */

export interface PassportBooking {
  id: string;
  artistName: string;
  /** ISO start timestamp. */
  startISO: string;
  style: string | null;
  status: string;
  cancelRequested: boolean;
}

const WHEN = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function BookingsList({
  upcoming,
  past,
}: {
  upcoming: PassportBooking[];
  past: PassportBooking[];
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return <p className="lead">Nothing booked yet — your next piece awaits.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h3 style={{ margin: "0 0 12px" }}>Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="lead">No upcoming bookings.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 10,
            }}
          >
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} cancellable />
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 12px" }}>Past</h3>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 10,
            }}
          >
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  cancellable = false,
}: {
  booking: PassportBooking;
  cancellable?: boolean;
}) {
  const [requested, setRequested] = useState(booking.cancelRequested);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestCancel() {
    startTransition(async () => {
      const res = await requestCancellationAction(booking.id);
      if (res.ok) {
        setRequested(true);
        setError(null);
      } else {
        setError(res.error ?? "Something went wrong — try again.");
      }
    });
  }

  return (
    <li
      className="card card-pad"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <b>{booking.style ?? "Tattoo session"}</b>
        <div style={{ opacity: 0.75, fontSize: 14 }}>
          {booking.artistName} · {WHEN.format(new Date(booking.startISO))}
        </div>
        {error && (
          <p role="alert" style={{ margin: "6px 0 0", fontSize: 13 }}>
            {error}
          </p>
        )}
      </div>
      {cancellable &&
        (requested ? (
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            Cancellation requested — we&apos;ll be in touch.
          </span>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={requestCancel}
            disabled={pending}
          >
            Request cancellation
          </button>
        ))}
    </li>
  );
}
