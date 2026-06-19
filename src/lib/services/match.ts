/**
 * Inkling Style Matcher — deterministic artist scoring.
 *
 * Ported exactly from design-src/COMPOSITION-NOTES.md ("Inkling Style Matcher —
 * deterministic scoring"). Five questions map option → tattoo styles; styles are
 * weighted (VIBES ×3 / SUBJECTS ×2 / COLOURS ×1.5); each artist is scored on the
 * sum of weights for the styles they work in, with a books bonus and a
 * first-timer bonus; results are ranked and a display percentage is derived.
 *
 * No AI, no randomness — same answers always produce the same ranking.
 */

export type Vibe = "trad" | "fine" | "dark" | "play" | "real" | "geo";
export type Subject =
  | "animal"
  | "floral"
  | "portrait"
  | "words"
  | "pattern"
  | "anime"
  | "unsure";
export type Colour = "bw" | "bold" | "touch";
export type Experience = "first" | "few" | "heavy";

export interface MatchAnswers {
  vibe?: Vibe | null;
  subject?: Subject | null;
  colour?: Colour | null;
  placement?: string | null;
  exp?: Experience | null;
}

/** Minimal artist shape required for scoring (subset of the Artist model). */
export interface MatchArtist {
  id: string;
  slug?: string | null;
  name: string;
  styles: string[];
  specials: string[];
  booksStatus: "open" | "limited" | "closed";
}

export interface MatchResult {
  artist: MatchArtist;
  rank: number;
  /** Raw weighted score (sum of style weights + bonuses). */
  raw: number;
  /** Display percentage, clamped 38–98. */
  pct: number;
  /** The artist's styles that intersect the weighted style set. */
  matchedStyles: string[];
  /** True for rank 0 ("Best fit"). */
  bestFit: boolean;
}

// --- Option → style maps (verbatim from COMPOSITION-NOTES) -------------------

const VIBES: Record<Vibe, string[]> = {
  trad: ["Neo-traditional", "Lettering"],
  fine: ["Fine-line", "Dotwork & Geometric"],
  dark: ["Blackwork", "Japanese"],
  play: ["Anime & New-school", "Colour"],
  real: ["Realism", "Colour"],
  geo: ["Dotwork & Geometric", "Blackwork"],
};

const SUBJECTS: Record<Subject, string[]> = {
  animal: ["Neo-traditional", "Realism", "Japanese"],
  floral: ["Fine-line", "Neo-traditional", "Colour"],
  portrait: ["Realism"],
  words: ["Lettering"],
  pattern: ["Dotwork & Geometric", "Blackwork"],
  anime: ["Anime & New-school"],
  unsure: [],
};

const COLOURS: Record<Colour, string[]> = {
  bw: ["Blackwork", "Realism", "Dotwork & Geometric", "Fine-line", "Lettering"],
  bold: ["Colour", "Neo-traditional", "Anime & New-school", "Japanese"],
  touch: ["Neo-traditional", "Japanese", "Colour"],
};

const VIBE_WEIGHT = 3;
const SUBJECT_WEIGHT = 2;
const COLOUR_WEIGHT = 1.5;

const BOOKS_BONUS: Record<MatchArtist["booksStatus"], number> = {
  open: 1.2,
  limited: 0.4,
  closed: 0,
};

const FIRST_TIMER_BONUS = 1.5;

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Build the weighted style map from the three answer dimensions.
 * Weights accumulate when a style appears in more than one map.
 */
export function buildStyleWeights(answers: MatchAnswers): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (styles: string[], weight: number) => {
    for (const s of styles) {
      weights.set(s, (weights.get(s) ?? 0) + weight);
    }
  };
  if (answers.vibe) add(VIBES[answers.vibe] ?? [], VIBE_WEIGHT);
  if (answers.subject) add(SUBJECTS[answers.subject] ?? [], SUBJECT_WEIGHT);
  if (answers.colour) add(COLOURS[answers.colour] ?? [], COLOUR_WEIGHT);
  return weights;
}

/**
 * Score and rank artists against the answer set. Returns the top `limit`
 * artists (default 4), highest raw score first.
 */
export function matchArtists(
  answers: MatchAnswers,
  artists: MatchArtist[],
  limit = 4,
): MatchResult[] {
  const weights = buildStyleWeights(answers);
  const isFirst = answers.exp === "first";

  const scored = artists.map((artist) => {
    let raw = 0;
    for (const style of artist.styles) {
      raw += weights.get(style) ?? 0;
    }
    raw += BOOKS_BONUS[artist.booksStatus];
    if (
      isFirst &&
      (artist.specials.includes("First tattoos") ||
        artist.styles.includes("Fine-line"))
    ) {
      raw += FIRST_TIMER_BONUS;
    }
    const matchedStyles = artist.styles.filter((s) => weights.has(s));
    return { artist, raw, matchedStyles };
  });

  scored.sort((a, b) => b.raw - a.raw);

  const max = scored[0]?.raw || 1;

  return scored.slice(0, limit).map((entry, i) => ({
    artist: entry.artist,
    rank: i,
    raw: entry.raw,
    pct: Math.round(
      clamp(38, 98, (entry.raw / max) * 92 + (i === 0 ? 6 : 0) - i * 1.5),
    ),
    matchedStyles: entry.matchedStyles,
    bestFit: i === 0,
  }));
}
