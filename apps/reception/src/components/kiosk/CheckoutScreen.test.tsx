import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutScreen } from "./CheckoutScreen";
import type { BoardArtist, BoardSession } from "./kiosk-logic";

const artist: BoardArtist = {
  id: "a1",
  name: "Sarah",
  status: "CO_OWNER",
  tag: null,
  headshot: null,
  hue: "crimson",
  hourlyRatePence: 9000,
  onLeave: false,
  checkedIn: true,
};

function sess(over: Partial<BoardSession> = {}): BoardSession {
  return {
    id: "s1",
    customerId: "c1",
    customerName: "Megan Wray",
    customerPhone: "07123 456789",
    customerEmail: "megan@example.com",
    artistId: "a1",
    start: new Date(2026, 6, 7, 10, 0).toISOString(),
    end: new Date(2026, 6, 7, 13, 0).toISOString(),
    durationMin: 180,
    type: "session",
    status: "confirmed",
    checkedInAt: new Date(2026, 6, 7, 9, 55).toISOString(),
    consentFlagged: false,
    completed: false,
    amountChargedPence: null,
    ...over,
  };
}

describe("CheckoutScreen", () => {
  it("pre-fills the estimate from the artist rate and shows the summary facts", () => {
    const html = renderToStaticMarkup(
      <CheckoutScreen
        session={sess()}
        artist={artist}
        onComplete={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Check out Megan");
    expect(html).toContain('value="270"'); // £90/hr × 3h
    expect(html).toContain("Consent form signed");
    expect(html).toContain("07123 456789");
    expect(html).toContain("Complete session · £270");
    expect(html).toContain("receipt and aftercare guide");
  });

  it("shows the flagged-consent and no-form variants", () => {
    const flagged = renderToStaticMarkup(
      <CheckoutScreen
        session={sess({ consentFlagged: true })}
        artist={artist}
        onComplete={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(flagged).toContain("Form signed · flagged");

    const noForm = renderToStaticMarkup(
      <CheckoutScreen
        session={sess({ checkedInAt: null, consentFlagged: null })}
        artist={artist}
        onComplete={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(noForm).toContain("No consent form");
  });
});
