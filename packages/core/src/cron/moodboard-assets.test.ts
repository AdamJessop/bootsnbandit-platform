import { describe, expect, it, vi } from "vitest";

const purge = vi.fn(async () => 3);
vi.mock("@bnb/core/services/moodboard-assets", () => ({
  purgeOrphanMoodboardAssets: (...a: unknown[]) => purge(...(a as [Date])),
}));
const { runMoodboardAssetPurge } = await import("./moodboard-assets");

describe("runMoodboardAssetPurge", () => {
  it("purges orphans older than 24h and reports the count", async () => {
    const now = new Date("2026-09-07T12:00:00Z");
    const res = await runMoodboardAssetPurge(now);
    expect(res).toEqual({ job: "moodboard_asset_purge", sent: 3, skipped: 0 });
    expect(purge.mock.calls[0][0].toISOString()).toBe(
      "2026-09-06T12:00:00.000Z",
    );
  });
});
