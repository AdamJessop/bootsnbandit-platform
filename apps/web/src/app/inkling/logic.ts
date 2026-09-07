/**
 * Pure logic for the Inkling Style Matcher (the mood-board builder has its
 * own logic in `./moodboard/logic.ts`).
 *
 * The matcher's scoring lives server-side in `lib/services/match.ts`; this
 * module only handles the questionnaire state and the `POST /api/match`
 * request shape. Deterministic, no AI.
 */

import { PLACEMENTS } from "../enquire/logic";

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

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  key: "vibe" | "subject" | "colour" | "placement" | "exp";
  prompt: string;
  options: QuizOption[];
}

export const MATCH_QUESTIONS: QuizQuestion[] = [
  {
    key: "vibe",
    prompt: "What's the overall vibe?",
    options: [
      { value: "trad", label: "Bold & traditional" },
      { value: "fine", label: "Delicate & fine-line" },
      { value: "dark", label: "Dark & moody" },
      { value: "play", label: "Playful & colourful" },
      { value: "real", label: "Lifelike & realistic" },
      { value: "geo", label: "Geometric & precise" },
    ],
  },
  {
    key: "subject",
    prompt: "What's the subject?",
    options: [
      { value: "animal", label: "An animal" },
      { value: "floral", label: "Florals or botanical" },
      { value: "portrait", label: "A portrait" },
      { value: "words", label: "Words or lettering" },
      { value: "pattern", label: "Pattern or ornamental" },
      { value: "anime", label: "Anime or character" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    key: "colour",
    prompt: "Colour or black & grey?",
    options: [
      { value: "bw", label: "Black & grey" },
      { value: "bold", label: "Bold colour" },
      { value: "touch", label: "A touch of colour" },
    ],
  },
  {
    key: "placement",
    prompt: "Roughly where on the body?",
    options: PLACEMENTS.map((p) => ({ value: p, label: p })),
  },
  {
    key: "exp",
    prompt: "How much ink have you got already?",
    options: [
      { value: "first", label: "This is my first" },
      { value: "few", label: "A few pieces" },
      { value: "heavy", label: "Heavily tattooed" },
    ],
  },
];

export interface QuizState {
  vibe: Vibe | null;
  subject: Subject | null;
  colour: Colour | null;
  placement: string | null;
  exp: Experience | null;
}

export function emptyQuiz(): QuizState {
  return {
    vibe: null,
    subject: null,
    colour: null,
    placement: null,
    exp: null,
  };
}

/** The three weighted questions drive the score; quiz is "ready" once they're set. */
export function quizComplete(s: QuizState): boolean {
  return Boolean(s.vibe && s.subject && s.colour);
}

export interface MatchPayload {
  vibe: Vibe | null;
  subject: Subject | null;
  colour: Colour | null;
  placement: string | null;
  exp: Experience | null;
  limit: number;
}

export function buildMatchPayload(s: QuizState, limit = 4): MatchPayload {
  return {
    vibe: s.vibe,
    subject: s.subject,
    colour: s.colour,
    placement: s.placement,
    exp: s.exp,
    limit,
  };
}

export interface MatchArtistLike {
  id: string;
  name: string;
  slug?: string | null;
  booksStatus?: "open" | "limited" | "closed";
}

export interface MatchResultLike {
  artist: MatchArtistLike;
  pct: number;
  matchedStyles: string[];
  bestFit: boolean;
}
