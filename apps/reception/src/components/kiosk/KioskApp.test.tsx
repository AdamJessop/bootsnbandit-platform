import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import { KioskApp } from "./KioskApp";
import type { BoardArtist, BoardSession } from "./kiosk-logic";

const artists: BoardArtist[] = [
  {
    id: "a1",
    name: "Sarah",
    status: "CO_OWNER",
    tag: null,
    headshot: null,
    hue: "crimson",
    hourlyRatePence: 9000,
    onLeave: false,
    checkedIn: true,
  },
  {
    id: "a2",
    name: "Rhodri",
    status: "RESIDENT",
    tag: null,
    headshot: null,
    hue: "teal",
    hourlyRatePence: 8000,
    onLeave: false,
    checkedIn: false,
  },
];

const sessions: BoardSession[] = [
  {
    id: "s1",
    customerId: "c1",
    customerName: "Megan Wray",
    customerPhone: null,
    customerEmail: null,
    artistId: "a1",
    start: new Date(Date.now() - 30 * 60_000).toISOString(),
    end: new Date(Date.now() + 60 * 60_000).toISOString(),
    durationMin: 90,
    type: "session",
    status: "confirmed",
    checkedInAt: new Date().toISOString(),
    consentFlagged: false,
    completed: false,
    amountChargedPence: null,
  },
];

const noop = async () => ({ ok: true }) as const;

describe("KioskApp home board", () => {
  it("renders brand, the three kiosk actions and the on-floor board", () => {
    const html = renderToStaticMarkup(
      <KioskApp
        board={{ artists, sessions }}
        actions={{
          toggleStaff: noop,
          customerCheckin: noop,
          walkIn: noop,
          checkout: noop,
          artistShowcase: async () => ({ ok: false, error: "x" }) as const,
        }}
      />,
    );
    expect(html).toContain("Front Desk");
    expect(html).toContain("Customer check-in");
    expect(html).toContain("Staff check-in");
    expect(html).toContain("New session");
    expect(html).toContain("On the floor today");
    expect(html).toContain("1 in · updated live");
    // Sarah is in (board card), Rhodri sits in the Not in strip
    expect(html).toContain("Megan Wray");
    expect(html).toContain("Not in");
    expect(html).toContain("Rhodri");
    expect(html).toContain("Today’s sessions");
  });

  it("makes every artist tappable to open their showcase", () => {
    const html = renderToStaticMarkup(
      <KioskApp
        board={{ artists, sessions }}
        actions={{
          toggleStaff: noop,
          customerCheckin: noop,
          walkIn: noop,
          checkout: noop,
          artistShowcase: async () => ({ ok: false, error: "x" }) as const,
        }}
      />,
    );
    // On-floor cards are tappable divs (role=button)…
    expect(html).toMatch(/<div class="rk-card"[^>]*role="button"/);
    // …and Not-in chips are real buttons.
    expect(html).toMatch(/<button[^>]*class="rk-off-chip"/);
  });
});
