import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./enquire.module.css", () => ({ default: {} }));

const { EnquireWizard } = await import("./EnquireWizard");

const ARTISTS = [
  {
    id: "a1",
    name: "Sarah Boots",
    role: "Co-owner",
    booksStatus: "open" as const,
  },
  {
    id: "a2",
    name: "Calum Rhodes",
    role: "Resident",
    booksStatus: "closed" as const,
  },
];

describe("EnquireWizard", () => {
  it("renders the stepper and artist choices", () => {
    const html = renderToStaticMarkup(
      <EnquireWizard artists={ARTISTS} styleOptions={["Fine-line"]} />,
    );
    expect(html).toContain("Pick your artist");
    expect(html).toContain("Sarah Boots");
    expect(html).toContain("No preference");
    expect(html).not.toContain("waitlist");
  });

  it("shows the waitlist note when seeded with a closed-books artist", () => {
    const html = renderToStaticMarkup(
      <EnquireWizard
        artists={ARTISTS}
        styleOptions={["Fine-line"]}
        seedArtistId="a2"
      />,
    );
    expect(html).toContain("waitlist");
    expect(html).toContain("Calum");
  });

  it("does not show the note when seeded with an open-books artist", () => {
    const html = renderToStaticMarkup(
      <EnquireWizard
        artists={ARTISTS}
        styleOptions={["Fine-line"]}
        seedArtistId="a1"
      />,
    );
    expect(html).not.toContain("waitlist");
  });
});
