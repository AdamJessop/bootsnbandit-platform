import { describe, expect, it } from "vitest";
import {
  buildInklingEnquiryPayload,
  buildMatchPayload,
  emptyQuiz,
  MATCH_QUESTIONS,
  quizComplete,
  type MatchResultLike,
  type QuizState,
} from "./logic";

describe("inkling logic — quiz", () => {
  it("exposes the five matcher questions", () => {
    expect(MATCH_QUESTIONS).toHaveLength(5);
    expect(MATCH_QUESTIONS.map((q) => q.key)).toEqual([
      "vibe",
      "subject",
      "colour",
      "placement",
      "exp",
    ]);
  });

  it("is complete once the three scoring questions are answered", () => {
    const s = emptyQuiz();
    expect(quizComplete(s)).toBe(false);
    s.vibe = "fine";
    s.subject = "floral";
    s.colour = "bw";
    expect(quizComplete(s)).toBe(true);
  });

  it("builds a match payload from the quiz", () => {
    const s: QuizState = {
      ...emptyQuiz(),
      vibe: "dark",
      subject: "pattern",
      colour: "bw",
      placement: "Forearm",
      exp: "first",
    };
    const p = buildMatchPayload(s);
    expect(p).toEqual({
      vibe: "dark",
      subject: "pattern",
      colour: "bw",
      placement: "Forearm",
      exp: "first",
      limit: 4,
    });
  });
});

describe("inkling logic — moodboard enquiry", () => {
  it("builds an inkling-source enquiry with references attached", () => {
    const p = buildInklingEnquiryPayload({
      name: "Ada",
      email: "ada@example.com",
      phone: "",
      note: "loving these",
      moodboard: ["data:a", "data:b"],
      artistId: "sarah",
    });
    expect(p.source).toBe("inkling");
    expect(p.preferredArtistId).toBe("sarah");
    expect(p.moodboard).toHaveLength(2);
    expect(p.contactName).toBe("Ada");
    expect(p.contactEmail).toBe("ada@example.com");
    expect(p.contactPhone).toBeNull();
    expect(p.description).toContain("loving these");
  });
});

describe("inkling logic — match enquiry from a result", () => {
  it("includes match data + best-fit styles in an inkling enquiry", () => {
    const result: MatchResultLike = {
      artist: { id: "marnie", name: "Amy", slug: "amy" },
      pct: 92,
      matchedStyles: ["Fine-line", "Dotwork & Geometric"],
      bestFit: true,
    };
    const quiz: QuizState = {
      ...emptyQuiz(),
      vibe: "fine",
      subject: "floral",
      colour: "bw",
    };
    const p = buildInklingEnquiryPayload({
      name: "Ada",
      email: "ada@example.com",
      phone: "",
      moodboard: [],
      artistId: result.artist.id,
      match: { quiz, result },
    });
    expect(p.preferredArtistId).toBe("marnie");
    expect(p.style).toBe("Fine-line, Dotwork & Geometric");
    expect(p.matchData).toMatchObject({ pct: 92 });
  });
});
