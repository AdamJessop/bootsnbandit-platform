import { describe, it, expect } from "vitest";
import { enquireHref, filterGallery, stepIndex } from "./logic";

const ITEMS = [
  { id: "1", style: "Fine-line", artistSlug: "sarah" },
  { id: "2", style: "Realism", artistSlug: "cal" },
  { id: "3", style: "Fine-line", artistSlug: "marnie" },
  { id: "4", style: "Colour", artistSlug: "sarah" },
];

describe("filterGallery", () => {
  it("returns all when both filters are 'all'", () => {
    expect(filterGallery(ITEMS, "all", "all")).toHaveLength(4);
  });

  it("filters by style", () => {
    expect(filterGallery(ITEMS, "Fine-line", "all").map((i) => i.id)).toEqual([
      "1",
      "3",
    ]);
  });

  it("filters by artist", () => {
    expect(filterGallery(ITEMS, "all", "sarah").map((i) => i.id)).toEqual([
      "1",
      "4",
    ]);
  });

  it("combines style + artist (AND)", () => {
    expect(filterGallery(ITEMS, "Fine-line", "sarah").map((i) => i.id)).toEqual(
      ["1"],
    );
  });
});

describe("stepIndex", () => {
  it("wraps forward", () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
  });

  it("wraps backward", () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(1, -1, 3)).toBe(0);
  });

  it("returns 0 for an empty set", () => {
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe("enquireHref", () => {
  it("links artist by slug and style via the plural styles= param", () => {
    expect(enquireHref({ artistSlug: "sarah", style: "Fine-line" })).toBe(
      "/enquire?artist=sarah&styles=Fine-line",
    );
  });

  it("omits missing fields", () => {
    expect(enquireHref({ artistSlug: "sarah", style: null })).toBe(
      "/enquire?artist=sarah",
    );
    expect(enquireHref({ artistSlug: null, style: "Realism" })).toBe(
      "/enquire?styles=Realism",
    );
    expect(enquireHref({})).toBe("/enquire");
  });
});
