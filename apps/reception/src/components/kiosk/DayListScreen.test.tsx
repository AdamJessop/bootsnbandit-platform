import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DayListScreen } from "./DayListScreen";
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
    customerDob: null,
    style: null,
    placement: null,
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

describe("DayListScreen", () => {
  it("shows counts, takings, consent state and per-row status", () => {
    const sessions = [
      sess({
        id: "done",
        customerName: "Robyn Carter",
        completed: true,
        amountChargedPence: 15000,
        checkedInAt: new Date().toISOString(),
        consentFlagged: false,
      }),
      sess({
        id: "flagged",
        customerName: "Dana Kowalski",
        checkedInAt: new Date().toISOString(),
        consentFlagged: true,
      }),
      sess({
        id: "booked",
        customerName: "Jake Turnbull",
        start: new Date(Date.now() + 2 * 3600_000).toISOString(),
        end: new Date(Date.now() + 3 * 3600_000).toISOString(),
      }),
    ];
    const html = renderToStaticMarkup(
      <DayListScreen
        artists={[artist]}
        sessions={sessions}
        now={new Date()}
        onCheckout={() => {}}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("3 booked · 1 complete · 1 consent flag to review");
    expect(html).toContain("Form flagged");
    expect(html).toContain("No form yet");
    expect(html).toContain("Complete");
    expect(html).toContain("In session"); // flagged one is arrived + mid-window
    expect(html).toContain("Check out");
    // Money never appears on the kiosk day list — no per-session amounts and
    // no daily takings (the front desk screen is customer-visible).
    expect(html).not.toContain("£");
    expect(html).not.toContain("Takings");
  });

  it("shows a friendly empty state with a New session shortcut", () => {
    const html = renderToStaticMarkup(
      <DayListScreen
        artists={[artist]}
        sessions={[]}
        now={new Date()}
        onCheckout={() => {}}
        onNew={() => {}}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Nothing booked in for today yet.");
    expect(html).toContain("New session");
  });
});
