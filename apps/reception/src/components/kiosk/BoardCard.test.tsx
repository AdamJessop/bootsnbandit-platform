import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardCard } from "./BoardCard";
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
  const now = Date.now();
  return {
    id: "s1",
    customerId: "c1",
    customerName: "Megan Wray",
    customerPhone: null,
    customerEmail: null,
    artistId: "a1",
    start: new Date(now - 30 * 60_000).toISOString(),
    end: new Date(now + 60 * 60_000).toISOString(),
    durationMin: 90,
    type: "session",
    status: "confirmed",
    checkedInAt: null,
    consentFlagged: null,
    completed: false,
    amountChargedPence: null,
    ...over,
  };
}

describe("BoardCard", () => {
  it("shows In session + progress + checkout for a checked-in current session", () => {
    const html = renderToStaticMarkup(
      <BoardCard
        artist={artist}
        sessions={[sess({ checkedInAt: new Date().toISOString() })]}
        now={new Date()}
        onCheckout={() => {}}
      />,
    );
    expect(html).toContain("In session");
    expect(html).toContain("Megan Wray");
    expect(html).toContain("rk-progress");
    expect(html).toContain("Check out");
  });

  it("keeps an un-arrived session in the Next slot and shows Client due", () => {
    const html = renderToStaticMarkup(
      <BoardCard
        artist={artist}
        sessions={[
          sess({
            start: new Date(Date.now() + 10 * 60_000).toISOString(),
            end: new Date(Date.now() + 70 * 60_000).toISOString(),
          }),
        ]}
        now={new Date()}
        onCheckout={() => {}}
      />,
    );
    expect(html).toContain("Client due");
    expect(html).toContain("Next:");
    expect(html).not.toContain("rk-progress");
  });

  it("shows Free with no bookings left", () => {
    const html = renderToStaticMarkup(
      <BoardCard
        artist={artist}
        sessions={[]}
        now={new Date()}
        onCheckout={() => {}}
      />,
    );
    expect(html).toContain("Free");
    expect(html).toContain("No more bookings today");
  });
});
