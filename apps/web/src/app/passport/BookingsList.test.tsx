import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  requestCancellationAction: vi.fn(),
}));
vi.mock("./passport.module.css", () => ({ default: {} }));

import { BookingsList, type PassportBooking } from "./BookingsList";

const upcoming: PassportBooking[] = [
  {
    id: "b1",
    artistName: "Sarah",
    startISO: "2099-08-01T11:00:00.000Z",
    style: "Fine-line fern",
    status: "confirmed",
    cancelRequested: false,
  },
  {
    id: "b2",
    artistName: "Calum",
    startISO: "2099-09-01T13:00:00.000Z",
    style: null,
    status: "pending",
    cancelRequested: true,
  },
];
const past: PassportBooking[] = [
  {
    id: "b0",
    artistName: "Amy",
    startISO: "2024-03-01T11:00:00.000Z",
    style: "Blackwork moth",
    status: "completed",
    cancelRequested: false,
  },
];

describe("BookingsList", () => {
  it("renders upcoming bookings with a request-cancellation control", () => {
    const html = renderToStaticMarkup(
      <BookingsList upcoming={upcoming} past={past} />,
    );
    expect(html).toContain("Sarah");
    expect(html).toContain("Fine-line fern");
    expect(html).toContain("Request cancellation");
  });

  it("shows the requested state instead of the button once flagged", () => {
    const html = renderToStaticMarkup(
      <BookingsList upcoming={upcoming} past={past} />,
    );
    expect(html).toContain("Cancellation requested");
  });

  it("lists past bookings and copes with empty lists", () => {
    const html = renderToStaticMarkup(
      <BookingsList upcoming={upcoming} past={past} />,
    );
    expect(html).toContain("Blackwork moth");

    const empty = renderToStaticMarkup(
      <BookingsList upcoming={[]} past={[]} />,
    );
    expect(empty).toContain("Nothing booked yet");
  });
});
