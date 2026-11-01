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

  it("locks the artist step to the flash design's artist and shows the piece", () => {
    const html = renderToStaticMarkup(
      <EnquireWizard
        artists={ARTISTS}
        styleOptions={["Fine-line"]}
        flash={{
          id: "f1",
          title: "Pearl Shell",
          artistId: "a1",
          pricePence: 13000,
          size: "~11cm",
        }}
      />,
    );
    expect(html).toContain("Your artist");
    expect(html).toContain("Sarah Boots");
    expect(html).not.toContain("No preference");
    expect(html).not.toContain("Calum Rhodes");
    expect(html).toContain("Your flash claim");
    expect(html).toContain("Pearl Shell · £130 · ~11cm");
  });

  it("keeps the artist picker open when the flash design has no artist", () => {
    const html = renderToStaticMarkup(
      <EnquireWizard
        artists={ARTISTS}
        styleOptions={["Fine-line"]}
        flash={{
          id: "f2",
          title: "Moth",
          artistId: null,
          pricePence: null,
          size: null,
        }}
      />,
    );
    expect(html).toContain("Pick your artist");
    expect(html).toContain("No preference");
    expect(html).toContain("Moth");
  });
});
