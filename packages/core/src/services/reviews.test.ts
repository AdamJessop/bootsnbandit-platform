import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const findUnique = vi.fn();
const findMany = vi.fn();
const count = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: { review: { updateMany, findUnique, findMany, count } },
}));

const {
  countReviewsAwaitingModeration,
  isReviewModerationAction,
  listReviewsForModeration,
  moderateReview,
  moderationActionsFor,
} = await import("./reviews");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moderationActionsFor", () => {
  it("offers each status only the moves that make sense", () => {
    expect(moderationActionsFor("submitted")).toEqual(["publish", "hide"]);
    expect(moderationActionsFor("published")).toEqual(["unpublish", "hide"]);
    expect(moderationActionsFor("hidden")).toEqual(["publish"]);
    // Nothing written yet — nothing to moderate.
    expect(moderationActionsFor("pending")).toEqual([]);
  });
});

describe("isReviewModerationAction", () => {
  it("accepts the three actions and nothing else", () => {
    expect(isReviewModerationAction("publish")).toBe(true);
    expect(isReviewModerationAction("hide")).toBe(true);
    expect(isReviewModerationAction("delete")).toBe(false);
    expect(isReviewModerationAction("toString")).toBe(false);
    expect(isReviewModerationAction(undefined)).toBe(false);
  });
});

describe("moderateReview", () => {
  it("moves the review only from a status the action allows", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    expect(await moderateReview("r1", "publish")).toEqual({
      ok: true,
      status: "published",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: { in: ["submitted", "hidden"] } },
      data: { status: "published" },
    });
  });

  it("puts an unpublished review back in the queue", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    expect(await moderateReview("r1", "unpublish")).toEqual({
      ok: true,
      status: "submitted",
    });
  });

  it("reports a stale screen with the status the review is really in", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ status: "hidden" });
    expect(await moderateReview("r1", "unpublish")).toEqual({
      ok: false,
      reason: "stale",
      status: "hidden",
    });
  });

  it("reports a review that no longer exists", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    expect(await moderateReview("gone", "hide")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("countReviewsAwaitingModeration", () => {
  it("counts submitted reviews", async () => {
    count.mockResolvedValue(3);
    expect(await countReviewsAwaitingModeration()).toBe(3);
    expect(count).toHaveBeenCalledWith({ where: { status: "submitted" } });
  });
});

describe("listReviewsForModeration", () => {
  it("lists written reviews only, flattened for the screen", async () => {
    const at = new Date("2026-10-01T10:00:00Z");
    findMany.mockResolvedValue([
      {
        id: "r1",
        status: "submitted",
        rating: 5,
        body: "Proper job",
        submittedAt: at,
        customer: { name: "Hannah M" },
        booking: { artist: { name: "Calum Reid" } },
      },
      {
        id: "r2",
        status: "hidden",
        rating: 2,
        body: null,
        submittedAt: at,
        customer: null,
        booking: null,
      },
    ]);
    const rows = await listReviewsForModeration();
    expect(findMany.mock.calls[0][0].where).toEqual({
      status: { in: ["submitted", "published", "hidden"] },
    });
    expect(rows).toEqual([
      {
        id: "r1",
        status: "submitted",
        rating: 5,
        body: "Proper job",
        customerName: "Hannah M",
        artistName: "Calum Reid",
        submittedAt: at,
      },
      {
        id: "r2",
        status: "hidden",
        rating: 2,
        body: null,
        customerName: null,
        artistName: null,
        submittedAt: at,
      },
    ]);
  });
});
