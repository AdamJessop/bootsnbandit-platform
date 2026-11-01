import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const moderateReview = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/services/reviews", async () => {
  const rules = await import("@bnb/core/services/review-moderation");
  return {
    ...rules,
    moderateReview: (...a: unknown[]) => moderateReview(...a),
  };
});

const { moderateReviewAction } = await import("./actions");

const OWNER = { id: "o1", role: "OWNER", email: "o@x", displayName: "Owner" };
const ARTIST = {
  id: "a1",
  role: "ARTIST",
  email: "a@x",
  displayName: "Artist",
  artistId: "art1",
};

describe("moderateReviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(OWNER);
  });

  it("lets an owner publish, and refreshes the screens that count reviews", async () => {
    moderateReview.mockResolvedValue({ ok: true, status: "published" });
    expect(
      await moderateReviewAction({ reviewId: "r1", action: "publish" }),
    ).toEqual({ ok: true, status: "published" });
    expect(moderateReview).toHaveBeenCalledWith("r1", "publish");
    expect(revalidatePath).toHaveBeenCalledWith("/content/reviews");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses an artist without touching the review", async () => {
    requireRole.mockResolvedValue(ARTIST);
    const res = await moderateReviewAction({ reviewId: "r1", action: "hide" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/owners/i);
    expect(moderateReview).not.toHaveBeenCalled();
  });

  it("rejects a forged action or a missing id", async () => {
    for (const input of [
      { reviewId: "r1", action: "delete" },
      { reviewId: "", action: "publish" },
      { reviewId: 42, action: "publish" },
    ]) {
      const res = await moderateReviewAction(input as never);
      expect(res).toEqual({ ok: false, error: "Invalid review action." });
    }
    expect(moderateReview).not.toHaveBeenCalled();
  });

  it("explains a stale move and still refreshes so the screen catches up", async () => {
    moderateReview.mockResolvedValue({
      ok: false,
      reason: "stale",
      status: "hidden",
    });
    const res = await moderateReviewAction({
      reviewId: "r1",
      action: "unpublish",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("hidden");
    expect(res.error).toMatch(/changed this review first/);
    expect(revalidatePath).toHaveBeenCalledWith("/content/reviews");
  });

  it("says when the review has gone", async () => {
    moderateReview.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await moderateReviewAction({
      reviewId: "gone",
      action: "hide",
    });
    expect(res.error).toBe("That review no longer exists.");
  });

  it("turns a thrown error into a result rather than crashing the screen", async () => {
    moderateReview.mockRejectedValue(new Error("db down"));
    expect(
      await moderateReviewAction({ reviewId: "r1", action: "publish" }),
    ).toEqual({ ok: false, error: "db down" });
  });
});
