import { describe, expect, it, vi } from "vitest";

const purge = vi.fn(async (_olderThan: Date) => 7);
vi.mock("@bnb/core/services/webhook-failures", () => ({
  purgeOldWebhookFailures: (...a: unknown[]) => purge(...(a as [Date])),
  WEBHOOK_FAILURE_RETENTION_DAYS: 90,
}));
const { runWebhookFailurePurge } = await import("./webhook-failures");

describe("runWebhookFailurePurge", () => {
  it("deletes failures older than 90 days and reports the count", async () => {
    const now = new Date("2026-09-08T12:00:00Z");
    const res = await runWebhookFailurePurge(now);
    expect(res).toEqual({ job: "webhook_failure_purge", sent: 7, skipped: 0 });
    expect(purge.mock.calls[0][0].toISOString()).toBe(
      "2026-06-10T12:00:00.000Z",
    );
  });
});
