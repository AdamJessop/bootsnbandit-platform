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

/**
 * Unauthenticated route: cap the body before doing any work with it. Checked
 * twice — against the (spoofable) `content-length` header before touching the
 * body at all, and against the actual bytes as they stream in, since a caller
 * can omit or lie about the header. The second check is what makes the cap
 * real: nothing is ever buffered past it.
 */
const MAX_BODY_BYTES = 1_048_576;

/**
 * The raw body, or null when it exceeds the cap.
 *
 * Deliberately NOT `req.text()`: that buffers whatever the caller sends before
 * anything — signature verification included — has had a chance to reject it,
 * so an unsigned request could pin memory at will. Reading the stream by hand
 * lets the read be abandoned the instant the running total crosses the cap.
 * The bytes are decoded exactly once, as UTF-8, and the resulting string is
 * what the signature is checked against: re-serialising would change the bytes
 * and break the signature.
 */
async function readCappedBody(req: Request): Promise<string | null> {
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

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

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "Payload too large");
  }

  // The raw text, not req.json(): re-serialising changes bytes and breaks
  // the signature. An oversize body is refused without a WebhookFailure row —
  // there is nothing to replay, and recording it would store the flood.
  const raw = await readCappedBody(req);
  if (raw === null) {
    return jsonError(413, "Payload too large");
  }

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
      // Truncated for display only — an unparseable body can't be replayed
      // as an event anyway, so the panel just needs enough to diagnose it.
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
