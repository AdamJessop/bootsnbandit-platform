"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import { ingestResendEvent } from "@bnb/core/services/channels/email-inbound";
import {
  getWebhookFailure,
  markWebhookFailureRetried,
  setWebhookFailureError,
} from "@bnb/core/services/webhook-failures";

/**
 * Owner-gated replay of a stored inbound webhook event.
 *
 * The retry runs the SAME `ingestResendEvent` the live webhook runs, so a
 * replay behaves identically to the original delivery (including its
 * idempotency check — replaying an event that did land is a no-op).
 *
 * It never throws on a failed replay: the fresh error is written back onto
 * the row so the panel shows what happened this time, rather than dumping the
 * owner into an error boundary.
 */

const CHANNELS_PATH = "/studio/channels";

export async function retryWebhookFailureAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;

  const row = await getWebhookFailure(id);
  // Phase 3 adds a "meta" branch here; today only Resend events are replayable.
  if (!row || row.provider !== "resend") return;

  try {
    await ingestResendEvent(row.payload);
    await markWebhookFailureRetried(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[channels] retry of ${id} failed again:`, err);
    await setWebhookFailureError(id, message);
  }
  revalidatePath(CHANNELS_PATH);
}
