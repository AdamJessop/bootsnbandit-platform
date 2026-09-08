"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import { ingestResendEvent } from "@bnb/core/services/channels/email-inbound";
import { parseMetaWebhook } from "@bnb/core/services/channels/meta";
import { ingestMetaEvent } from "@bnb/core/services/channels/meta-inbound";
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
  // Unlike `_lib/actions.ts`, a missing id here is a hidden-input value the
  // owner never typed — no-op rather than throw into an error boundary.
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;

  const row = await getWebhookFailure(id);
  if (!row) return;

  try {
    if (row.provider === "resend") {
      const outcome = await ingestResendEvent(row.payload);
      if (outcome.status === "ignored" && outcome.reason === "unsupported_event") {
        // The route stored this because the original body could not even be
        // parsed as an event (e.g. malformed JSON) — there is nothing to
        // replay, so treat it as a fresh failure rather than declaring victory.
        await setWebhookFailureError(
          id,
          "Stored payload is not a replayable Resend event (original body could not be parsed) — check the delivery in the Resend dashboard.",
        );
      } else {
        await markWebhookFailureRetried(id);
      }
    } else if (row.provider === "meta") {
      // The webhook stores ONE event per failure (`singleEventBody`), so this
      // parses back to exactly the event that broke.
      const events = parseMetaWebhook(row.payload);
      if (events.length === 0) {
        await setWebhookFailureError(
          id,
          "Stored payload is not a replayable Meta event (original body could not be parsed) — check the delivery in the Meta app dashboard.",
        );
      } else {
        const outcomes = [];
        for (const event of events) outcomes.push(await ingestMetaEvent(event));

        // Mirrors the resend branch: an ignored-because-there-was-nothing-to-
        // do outcome is not a successful replay, so it must not be marked
        // retried — the owner would otherwise believe the cause was fixed.
        const unknownPage = outcomes.some(
          (o) => o.status === "ignored" && o.reason === "unknown_page",
        );
        const unsupported = outcomes.some(
          (o) => o.status === "ignored" && o.reason === "unsupported",
        );

        if (unknownPage) {
          // The Page/IG account this event names is not (or no longer)
          // connected — reconnecting is the fix, not retrying blindly.
          await setWebhookFailureError(
            id,
            "No active Facebook Page or Instagram connection matches this event — reconnect the Page in Studio › Channels, then retry.",
          );
        } else if (unsupported) {
          // Receipts/postbacks/other non-message kinds: nothing to record.
          await setWebhookFailureError(
            id,
            "Stored payload is not a replayable Meta event — check the delivery in the Meta app dashboard.",
          );
        } else {
          // recorded / duplicate / ignored:echo_known / ignored:no_message
          // all mean the replay did what the original delivery would have.
          await markWebhookFailureRetried(id);
        }
      }
    } else {
      // An unknown provider has no replay path; leave the row open.
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[channels] retry of ${id} failed again:`, err);
    await setWebhookFailureError(id, message);
  }
  revalidatePath(CHANNELS_PATH);
}
