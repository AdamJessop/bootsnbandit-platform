import { json, jsonError } from "@bnb/core/http";
import { ingestResendEvent } from "@bnb/core/services/channels/email-inbound";
import { verifyWebhookSignature } from "@bnb/core/services/channels/webhook-signature";
import { recordWebhookFailure } from "@bnb/core/services/webhook-failures";

/**
 * POST /api/webhooks/resend — inbound email.
 *
 * Unauthenticated but verified, exactly like /api/cron/run: the caller proves
 * itself with a Standard-Webhooks (Svix) signature over the RAW body, checked
 * against `RESEND_WEBHOOK_SECRET`. Unsigned or wrongly signed requests get a
 * 401 and are never processed; there is no rate limit because there is no
 * unsigned work to do.
 *
 * Everything past verification answers **200**, even on failure. Resend
 * retries 5xx, so returning one for a broken event storms this endpoint with
 * the same broken event; instead the whole event is written to
 * `WebhookFailure` and Studio › Channels offers a replay.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Best-effort id for the failure row, so the panel can name the email. */
function externalIdOf(event: unknown): string | null {
  const id = (event as { data?: { email_id?: unknown } } | null)?.data?.email_id;
  return typeof id === "string" ? id : null;
}

/** Never lets a failed audit write turn into a 500. */
async function noteFailure(input: {
  externalId: string | null;
  payload: unknown;
  error: string;
}): Promise<void> {
  try {
    await recordWebhookFailure({
      provider: "resend",
      externalId: input.externalId,
      payload: input.payload,
      error: input.error,
    });
  } catch (err) {
    console.error("[webhooks/resend] could not record the failure:", err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return jsonError(503, "RESEND_WEBHOOK_SECRET is not configured");
  }

  // The raw text, not req.json(): re-serialising changes bytes and breaks
  // the signature.
  const raw = await req.text();
  const verified = verifyWebhookSignature({
    secret,
    payload: raw,
    headers: req.headers,
  });
  if (!verified.ok) {
    console.warn(`[webhooks/resend] rejected a delivery: ${verified.reason}`);
    return jsonError(401, "Invalid signature");
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    await noteFailure({
      externalId: null,
      payload: { raw: raw.slice(0, 4000) },
      error: "Malformed JSON body on a correctly signed request",
    });
    return json({ ok: false, status: "failed" }, 200);
  }

  try {
    const outcome = await ingestResendEvent(event);
    return json({ ok: true, ...outcome }, 200);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/resend] processing failed:", err);
    await noteFailure({ externalId: externalIdOf(event), payload: event, error });
    return json({ ok: false, status: "failed" }, 200);
  }
}
