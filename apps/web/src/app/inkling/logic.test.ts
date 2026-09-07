import { describe, expect, it } from "vitest";
import {
  buildMatchPayload,
  emptyQuiz,
  MATCH_QUESTIONS,
  quizComplete,
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
