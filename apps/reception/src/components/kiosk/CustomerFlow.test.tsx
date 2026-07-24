import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsentScreen, CustomerFlow } from "./CustomerFlow";
import {
  CONSENT_QUESTIONS,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

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
    customerPhone: null,
    customerEmail: null,
    artistId: "a1",
    start: new Date(2026, 6, 7, 10, 0).toISOString(),
    end: new Date(2026, 6, 7, 13, 0).toISOString(),
    durationMin: 180,
    type: "session",
    status: "confirmed",
    checkedInAt: null,
    consentFlagged: null,
    completed: false,
    amountChargedPence: null,
    ...over,
  };
}

describe("CustomerFlow picker", () => {
  it("lists only sessions still awaiting arrival", () => {
    const html = renderToStaticMarkup(
      <CustomerFlow
        artists={[artist]}
        sessions={[
          sess(),
          sess({
            id: "here",
            customerName: "Already Here",
            checkedInAt: new Date().toISOString(),
          }),
        ]}
        onCheckin={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Megan Wray");
    expect(html).not.toContain("Already Here");
    expect(html).toContain("find your session");
  });

  it("shows the all-checked-in empty state", () => {
    const html = renderToStaticMarkup(
      <CustomerFlow
        artists={[artist]}
        sessions={[]}
        onCheckin={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Everyone’s checked in");
  });
});

describe("ConsentScreen", () => {
  it("renders every consent question with yes/no controls and a signature pad", () => {
    const html = renderToStaticMarkup(
      <ConsentScreen
        session={sess()}
        artist={artist}
        onDone={async () => ({ ok: true })}
        onBack={() => {}}
      />,
    );
    for (const q of CONSENT_QUESTIONS) {
      expect(html).toContain(q.q);
    }
    expect(html).toContain("Signature — Megan Wray");
    expect(html).toContain("<canvas");
    // submit stays disabled until answered + signed
    expect(html).toContain("Answer all questions to finish");
  });
});
