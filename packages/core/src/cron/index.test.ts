import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `runAllCron` orchestrates the individual jobs and returns a per-job summary
 * plus totals. The jobs themselves are mocked here (covered by their own tests).
 */

const runReminders = vi.fn();
const runReviewRequests = vi.fn();
const runLoyaltyRewards = vi.fn();

vi.mock("./reminders", () => ({ runReminders: (...a: unknown[]) => runReminders(...a) }));
vi.mock("./review-requests", () => ({
  runReviewRequests: (...a: unknown[]) => runReviewRequests(...a),
}));
vi.mock("./loyalty-rewards", () => ({
  runLoyaltyRewards: (...a: unknown[]) => runLoyaltyRewards(...a),
}));

const { runAllCron } = await import("./index");

beforeEach(() => {
  runReminders.mockReset().mockResolvedValue({ job: "reminders", sent: 1, skipped: 0 });
  runReviewRequests
    .mockReset()
    .mockResolvedValue({ job: "review_requests", sent: 2, skipped: 1 });
  runLoyaltyRewards
    .mockReset()
    .mockResolvedValue({ job: "loyalty_rewards", sent: 0, skipped: 3 });
});

describe("runAllCron", () => {
  it("runs every job and aggregates totals", async () => {
    const res = await runAllCron();
    expect(runReminders).toHaveBeenCalledOnce();
    expect(runReviewRequests).toHaveBeenCalledOnce();
    expect(runLoyaltyRewards).toHaveBeenCalledOnce();
    expect(res.jobs).toHaveLength(3);
    expect(res.totalSent).toBe(3);
    expect(res.totalSkipped).toBe(4);
  });
});
