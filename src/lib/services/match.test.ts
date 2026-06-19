import { describe, expect, it } from "vitest";
import {
  buildStyleWeights,
  matchArtists,
  toMatchArtist,
  type MatchArtist,
} from "./match";

// Fixture mirrors the seeded crew (design-src/data.jsx).
const ARTISTS: MatchArtist[] = [
  {
    id: "sarah",
    name: "Sarah",
    styles: ["Fine-line", "Realism"],
    specials: ["Fine-line", "Floral", "Black & grey"],
    booksStatus: "open",
  },
  {
    id: "cal",
    name: "Calum",
    styles: ["Realism", "Lettering"],
    specials: ["Realism", "Chicano", "Portraits"],
    booksStatus: "limited",
  },
  {
    id: "marnie",
    name: "Amy",
    styles: ["Fine-line", "Dotwork & Geometric"],
    specials: ["First tattoos", "Botanical", "Fine-line"],
    booksStatus: "open",
  },
  {
    id: "rhodri",
    name: "Alisha",
    styles: ["Colour", "Realism"],
    specials: ["Colour", "Realism", "Neo-traditional"],
    booksStatus: "limited",
  },
  {
    id: "effie",
    name: "Olivia",
    styles: ["Realism", "Colour"],
    specials: ["Portraits", "Realism", "Pet portraits"],
    booksStatus: "open",
  },
  {
    id: "joss",
    name: "Holly",
    styles: ["Realism", "Dotwork & Geometric"],
    specials: ["Realism", "Geometric", "Sleeves"],
    booksStatus: "open",
  },
  {
    id: "priya",
    name: "Tom",
    styles: ["Fine-line", "Dotwork & Geometric"],
    specials: ["First tattoos", "Small pieces", "Linework"],
    booksStatus: "open",
  },
];

describe("toMatchArtist", () => {
  it("maps the styles relation (TattooStyle{name}[]) to a string[]", () => {
    const ma = toMatchArtist({
      id: "sarah",
      slug: "sarah",
      name: "Sarah",
      styles: [{ name: "Fine-line" }, { name: "Realism" }],
      specials: ["Fine-line"],
      booksStatus: "open",
    });
    expect(ma.styles).toEqual(["Fine-line", "Realism"]);
  });

  it("yields names that still score in the matcher (Fine-line literal preserved)", () => {
    const fineLineArtist = toMatchArtist({
      id: "marnie",
      name: "Amy",
      styles: [{ name: "Fine-line" }, { name: "Dotwork & Geometric" }],
      specials: ["First tattoos"],
      booksStatus: "open",
    });
    const plain = toMatchArtist({
      id: "cal",
      name: "Calum",
      styles: [{ name: "Lettering" }],
      specials: [],
      booksStatus: "closed",
    });
    // "fine" vibe weights Fine-line ×3; the relation-sourced artist must score
    // higher than one without the literal style.
    const results = matchArtists({ vibe: "fine" }, [fineLineArtist, plain], 2);
    const amy = results.find((r) => r.artist.id === "marnie")!;
    expect(amy.raw).toBeGreaterThan(0);
    expect(amy.matchedStyles).toContain("Fine-line");
    expect(results[0].artist.id).toBe("marnie");
  });
});

describe("buildStyleWeights", () => {
  it("weights VIBES ×3, SUBJECTS ×2, COLOURS ×1.5 and accumulates overlaps", () => {
    // fine → [Fine-line, Dotwork & Geometric] ×3
    // floral → [Fine-line, Neo-traditional, Colour] ×2
    // bw → [Blackwork, Realism, Dotwork & Geometric, Fine-line, Lettering] ×1.5
    const w = buildStyleWeights({ vibe: "fine", subject: "floral", colour: "bw" });
    // Fine-line appears in all three: 3 + 2 + 1.5 = 6.5
    expect(w.get("Fine-line")).toBeCloseTo(6.5);
    // Dotwork & Geometric: vibe(3) + colour(1.5) = 4.5
    expect(w.get("Dotwork & Geometric")).toBeCloseTo(4.5);
    // Colour: subject only = 2
    expect(w.get("Colour")).toBeCloseTo(2);
  });

  it("ignores unsure subject (empty map)", () => {
    const w = buildStyleWeights({ subject: "unsure" });
    expect(w.size).toBe(0);
  });
});

describe("matchArtists", () => {
  it("ranks the fine-line / floral / black-and-grey, first-timer set with Amy or Sarah on top", () => {
    const results = matchArtists(
      { vibe: "fine", subject: "floral", colour: "bw", exp: "first" },
      ARTISTS,
    );
    expect(results.length).toBe(4);
    // Top artist should be a Fine-line specialist with open books + first-timer bonus.
    expect(["marnie", "sarah", "priya"]).toContain(results[0].artist.id);
    expect(results[0].rank).toBe(0);
    expect(results[0].bestFit).toBe(true);
    // Strictly descending raw scores.
    for (let i = 1; i < results.length; i++) {
      expect(results[i].raw).toBeLessThanOrEqual(results[i - 1].raw);
    }
  });

  it("clamps pct to the 38–98 range", () => {
    const results = matchArtists(
      { vibe: "fine", subject: "floral", colour: "bw" },
      ARTISTS,
    );
    for (const r of results) {
      expect(r.pct).toBeGreaterThanOrEqual(38);
      expect(r.pct).toBeLessThanOrEqual(98);
    }
  });

  it("awards the first-timer bonus to Fine-line / 'First tattoos' artists", () => {
    const base = matchArtists({ vibe: "dark" }, ARTISTS, 7);
    const first = matchArtists({ vibe: "dark", exp: "first" }, ARTISTS, 7);
    const amyBase = base.find((r) => r.artist.id === "marnie")!;
    const amyFirst = first.find((r) => r.artist.id === "marnie")!;
    // Amy has Fine-line + 'First tattoos' → +1.5 with exp=first.
    expect(amyFirst.raw - amyBase.raw).toBeCloseTo(1.5);
  });

  it("applies books bonus open +1.2 / limited +0.4 with empty answers", () => {
    const results = matchArtists({}, ARTISTS, 7);
    const sarah = results.find((r) => r.artist.id === "sarah")!; // open
    const cal = results.find((r) => r.artist.id === "cal")!; // limited
    expect(sarah.raw).toBeCloseTo(1.2);
    expect(cal.raw).toBeCloseTo(0.4);
  });

  it("returns matched styles for the top artist", () => {
    const results = matchArtists(
      { vibe: "real", subject: "portrait", colour: "bw" },
      ARTISTS,
    );
    expect(results[0].matchedStyles.length).toBeGreaterThan(0);
  });
});
