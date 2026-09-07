import { runReminders, type CronJobResult } from "./reminders";
import { runReviewRequests } from "./review-requests";
import { runLoyaltyRewards } from "./loyalty-rewards";
import { runMoodboardAssetPurge } from "./moodboard-assets";

export type { CronJobResult } from "./reminders";
export { runReminders } from "./reminders";
export { runReviewRequests } from "./review-requests";
export { runLoyaltyRewards } from "./loyalty-rewards";
export { runMoodboardAssetPurge } from "./moodboard-assets";

export interface CronRunSummary {
  ranAt: string;
  jobs: CronJobResult[];
  totalSent: number;
  totalSkipped: number;
}

/**
 * Run every CRM cron automation in sequence and return a combined summary.
 * Each job is independently idempotent (deduped via MessageLog), so the whole
 * sweep is safe to invoke repeatedly. Called by `POST /api/cron/run`.
 */
export async function runAllCron(): Promise<CronRunSummary> {
  const jobs: CronJobResult[] = [];
  jobs.push(await runReminders());
  jobs.push(await runReviewRequests());
  jobs.push(await runLoyaltyRewards());
  jobs.push(await runMoodboardAssetPurge());

  const totalSent = jobs.reduce((n, j) => n + j.sent, 0);
  const totalSkipped = jobs.reduce((n, j) => n + j.skipped, 0);

  return {
    ranAt: new Date().toISOString(),
    jobs,
    totalSent,
    totalSkipped,
  };
}
