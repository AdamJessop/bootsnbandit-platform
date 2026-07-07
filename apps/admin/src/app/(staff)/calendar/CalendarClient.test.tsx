import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// CalendarClient pulls in the server actions module transitively, which imports
// the server-only auth helper. Stub it so the module graph loads in node.
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/services/bookings", () => ({
  BookingConflictError: class extends Error {},
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { CalendarClient } from "./CalendarClient";
import { shiftAnchor } from "./nav";

describe("CalendarClient module", () => {
  it("exports the client component", () => {
    expect(typeof CalendarClient).toBe("function");
  });

  it("uses the tested anchor stepper for nav", () => {
    const base = new Date(2026, 5, 16, 12).toISOString();
    expect(new Date(shiftAnchor(base, "day", 1)).getDate()).toBe(17);
    expect(new Date(shiftAnchor(base, "week", -1)).getDate()).toBe(9);
  });

  it("closed artist select shows the artist's name, not the cuid", () => {
    const html = renderToStaticMarkup(
      <CalendarClient
        canSwitchArtist
        artists={[
          { id: "cln4artist1aaaa", name: "Sarah North" },
          { id: "cln4artist2bbbb", name: "Bandit" },
        ]}
        activeArtistId="cln4artist1aaaa"
        view="day"
        anchorISO={new Date(2026, 5, 16, 12).toISOString()}
        events={[]}
        leave={[]}
        customers={[]}
      />,
    );
    const trigger = html.match(/data-slot="select-value"[^>]*>([^<]*)</);
    expect(trigger?.[1]).toBe("Sarah North");
  });
});
