import { describe, expect, it } from "vitest";
import {
  CONFIRM_PROMPT,
  countByView,
  moveReview,
  stars,
  type ReviewRow,
} from "./review-view";

function row(id: string, status: ReviewRow["status"]): ReviewRow {
  return {
    id,
    status,
    rating: 5,
    body: "Proper job",
    customerName: "Hannah M",
    artistName: "Calum",
    submittedLabel: "12 Oct 2026",
  };
}

describe("countByView", () => {
  it("counts each tab and ignores pending reviews", () => {
    expect(
      countByView([
        row("a", "submitted"),
        row("b", "submitted"),
        row("c", "published"),
        row("d", "pending"),
      ]),
    ).toEqual({ submitted: 2, published: 1, hidden: 0 });
  });
});

describe("moveReview", () => {
  const rows = [row("a", "submitted"), row("b", "published")];

  it("moves only the targeted review, by the server's rules", () => {
    const next = moveReview(rows, { id: "a", action: "publish" });
    expect(next.map((r) => r.status)).toEqual(["published", "published"]);
    // Pure: the input is untouched.
    expect(rows[0].status).toBe("submitted");
  });

  it("sends an unpublished review back to Awaiting", () => {
    expect(moveReview(rows, { id: "b", action: "unpublish" })[1].status).toBe(
      "submitted",
    );
  });

  it("ignores a move the rules don't allow from the current status", () => {
    expect(moveReview(rows, { id: "a", action: "unpublish" })).toEqual(rows);
  });
});

describe("CONFIRM_PROMPT", () => {
  it("asks before taking a review off the site, never before publishing", () => {
    expect(CONFIRM_PROMPT.hide).toBeTruthy();
    expect(CONFIRM_PROMPT.unpublish).toBeTruthy();
    expect(CONFIRM_PROMPT.publish).toBeUndefined();
  });
});

describe("stars", () => {
  it("renders filled and empty stars out of five", () => {
    expect(stars(4)).toBe("★★★★☆");
    expect(stars(5)).toBe("★★★★★");
    expect(stars(9)).toBe("★★★★★");
    expect(stars(null)).toBe("");
  });
});
