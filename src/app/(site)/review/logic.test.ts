import { describe, expect, it } from "vitest";
import { buildReviewPayload, isReviewValid } from "./logic";

describe("review logic", () => {
  it("requires a rating of 1–5", () => {
    expect(isReviewValid({ rating: 0, body: "great" })).toBe(false);
    expect(isReviewValid({ rating: 6, body: "great" })).toBe(false);
    expect(isReviewValid({ rating: 5, body: "" })).toBe(true);
    expect(isReviewValid({ rating: 4, body: "lovely" })).toBe(true);
  });

  it("builds a payload with the token and trimmed body", () => {
    const p = buildReviewPayload("tok123", { rating: 5, body: "  great work  " });
    expect(p).toEqual({ token: "tok123", rating: 5, body: "great work" });
  });

  it("nulls an empty body", () => {
    const p = buildReviewPayload("tok123", { rating: 5, body: "   " });
    expect(p.body).toBeNull();
  });
});
