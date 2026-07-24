import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewSessionScreen } from "./NewSessionScreen";
import type { BoardArtist } from "./kiosk-logic";

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

describe("NewSessionScreen", () => {
  it("renders name/phone fields, artist picks (with out marker), lengths and slots", () => {
    const html = renderToStaticMarkup(
      <NewSessionScreen
        artists={artists}
        now={new Date(2026, 6, 7, 10, 3)}
        onCreate={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Customer name");
    expect(html).toContain("Phone (optional)");
    // Email powers the receipt + aftercare send at checkout.
    expect(html).toContain("Email");
    expect(html).toContain("rk-email");
    expect(html).toContain("Sarah");
    expect(html).toContain("Rhodri");
    expect(html).toContain("(out)"); // Rhodri isn't checked in
    expect(html).toContain("15 min consult");
    expect(html).toContain("Full day");
    expect(html).toContain("10:30"); // first rounded half-hour slot
    expect(html).toContain("Book it in");
    expect(html).toContain("disabled"); // CTA disabled until form is complete
  });
});
