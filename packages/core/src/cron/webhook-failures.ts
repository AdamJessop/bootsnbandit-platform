import {
  purgeOldWebhookFailures,
  WEBHOOK_FAILURE_RETENTION_DAYS,
} from "@bnb/core/services/webhook-failures";
import type { CronJobResult } from "./reminders";

/** Housekeeping: drop stored webhook bodies past their retention window. */
export async function runWebhookFailurePurge(
  now: Date = new Date(),
): Promise<CronJobResult> {
  const deleted = await purgeOldWebhookFailures(
    new Date(now.getTime() - WEBHOOK_FAILURE_RETENTION_DAYS * 24 * 3600_000),
  );
  return { job: "webhook_failure_purge", sent: deleted, skipped: 0 };
}
