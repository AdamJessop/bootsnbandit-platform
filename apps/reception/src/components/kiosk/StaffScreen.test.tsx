import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaffScreen } from "./StaffScreen";
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
    name: "Marnie",
    status: "APPRENTICE",
    tag: null,
    headshot: null,
    hue: "plum",
    hourlyRatePence: null,
    onLeave: true,
    checkedIn: false,
  },
];

describe("StaffScreen", () => {
  it("renders a tile per artist with in/out state and role label", () => {
    const html = renderToStaticMarkup(
      <StaffScreen artists={artists} onToggle={() => {}} onExit={() => {}} />,
    );
    expect(html).toContain("Sarah");
    expect(html).toContain("Marnie");
    expect(html).toContain("Co-owner");
    expect(html).toContain("Apprentice");
    expect(html).toContain(">In<");
    expect(html).toContain(">Out<");
    expect(html).toContain("On leave");
  });
});
