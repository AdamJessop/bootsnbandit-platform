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
    idCheckedBy: null,
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
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("In session");
    // The board faces the waiting area: first name + initial only.
    expect(html).toContain("Megan W.");
    expect(html).not.toContain("Megan Wray");
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
        onOpen={() => {}}
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
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("Free");
    expect(html).toContain("No more bookings today");
  });

  it("is tappable to open the artist showcase without nesting buttons", () => {
    const html = renderToStaticMarkup(
      <BoardCard
        artist={artist}
        sessions={[sess({ checkedInAt: new Date().toISOString() })]}
        now={new Date()}
        onCheckout={() => {}}
        onOpen={() => {}}
      />,
    );
    // The card div itself is the tap target (a wrapping <button> would nest
    // the inner Check out button — invalid HTML).
    expect(html).toMatch(/<div class="rk-card"[^>]*role="button"/);
    expect(html).toContain("Check out");
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*<button/);
  });
});
