import { purgeOrphanMoodboardAssets } from "@bnb/core/services/moodboard-assets";
import type { CronJobResult } from "./reminders";

/** Housekeeping: drop mood-board uploads never sent with an enquiry (24h grace). */
const GRACE_HOURS = 24;

export async function runMoodboardAssetPurge(
  now: Date = new Date(),
): Promise<CronJobResult> {
  const deleted = await purgeOrphanMoodboardAssets(
    new Date(now.getTime() - GRACE_HOURS * 3600_000),
  );
  return { job: "moodboard_asset_purge", sent: deleted, skipped: 0 };
}
