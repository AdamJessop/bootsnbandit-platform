import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistEditor } from "./ArtistEditor";

const noop = vi.fn();

const styles = [
  { id: "s1", name: "Fine-line" },
  { id: "s2", name: "Bold" },
];

const rows = [
  {
    id: "a1",
    slug: "sarah",
    name: "Sarah",
    status: "CO_OWNER" as const,
    email: "sarah@studio.test",
    accessRole: "OWNER" as const,
    tag: null,
    bio: null,
    specials: ["Snakes"],
    hourlyRatePence: 9000,
    dayRatePence: 60000,
    insta: null,
    headshot: null,
    hue: null,
    booksStatus: "open",
    sortOrder: 0,
    active: true,
    styleIds: ["s1"],
  },
];

describe("ArtistEditor", () => {
  it("lists artists with the status label and £ rates", () => {
    const html = renderToStaticMarkup(
      <ArtistEditor
        rows={rows}
        styles={styles}
        createAction={noop}
        updateAction={noop}
        deleteAction={noop}
      />,
    );
    expect(html).toContain("Sarah");
    expect(html).toContain("Co-owner");
    expect(html).toContain("£90");
    expect(html).toContain("£600");
  });

  it("shows the per-artist email and an Add artist trigger; no legacy fields", () => {
    const html = renderToStaticMarkup(
      <ArtistEditor
        rows={rows}
        styles={styles}
        createAction={noop}
        updateAction={noop}
        deleteAction={noop}
      />,
    );
    expect(html).toContain("Add artist");
    expect(html).toContain("sarah@studio.test");
    // no legacy free-text rate field anywhere in the roster
    expect(html).not.toContain('name="rateText"');
    expect(html).not.toContain("Rate text");
  });
});
