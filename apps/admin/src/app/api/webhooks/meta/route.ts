import { json, jsonError } from "@bnb/core/http";
import {
  META_SIGNATURE_HEADER,
  parseMetaWebhook,
  singleEventBody,
  verifyHubChallenge,
  verifyMetaSignature,
  type MetaMessagingEvent,
} from "@bnb/core/services/channels/meta";
import {
  ingestMetaEvent,
  type MetaIngestOutcome,
} from "@bnb/core/services/channels/meta-inbound";
import { recordWebhookFailure } from "@bnb/core/services/webhook-failures";

/**
 * GET/POST /api/webhooks/meta — Messenger + Instagram DMs.
 *
 * GET is Meta's subscription handshake: it calls this URL with our
 * `hub.verify_token` and a `hub.challenge` we echo back verbatim as
 * text/plain. POST is the event feed, signed with `X-Hub-Signature-256` =
 * `sha256=` + HMAC-SHA256(META_APP_SECRET, raw body).
 *
 * Everything past verification answers **200**, even on failure: Meta retries
 * and eventually DISABLES a webhook that keeps erroring, so returning a 5xx
 * for a broken event would take the whole channel offline. Instead each failed
 * event is written to `WebhookFailure` on its own — a delivery can carry many
 * events, and Retry should replay only the one that broke.
 *
 * Ships dark: with `META_VERIFY_TOKEN` / `META_APP_SECRET` unset both verbs
 * answer 503 and nothing is processed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated route: cap the body before doing any work with it. Checked
 * twice — against the (spoofable) `content-length` header before touching the
 * body at all, and against the actual bytes as they stream in, since a caller
 * can omit or lie about the header.
 */
const MAX_BODY_BYTES = 1_048_576;

/**
 * The raw body, or null when it exceeds the cap.
 *
 * Deliberately NOT `req.text()`: that buffers whatever the caller sends before
 * anything — signature verification included — has had a chance to reject it.
 * The bytes are decoded exactly once, as UTF-8, and that string is what the
 * signature is checked against: re-serialising would change the bytes.
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

/** Never lets a failed audit write turn into a 500. */
async function noteFailure(input: {
  externalId: string | null;
  payload: unknown;
  error: string;
}): Promise<void> {
  try {
    await recordWebhookFailure({
      provider: "meta",
      externalId: input.externalId,
      payload: input.payload,
      error: input.error,
    });
  } catch (err) {
    console.error("[webhooks/meta] could not record the failure:", err);
  }
}

export async function GET(req: Request): Promise<Response> {
  const result = verifyHubChallenge(
    new URL(req.url).searchParams,
    process.env.META_VERIFY_TOKEN,
  );
  if (!result.ok) {
    if (result.reason === "not_configured") {
      return jsonError(503, "META_VERIFY_TOKEN is not configured");
    }
    console.warn(`[webhooks/meta] rejected a verification: ${result.reason}`);
    return jsonError(403, "Verification failed");
  }
  // Verbatim plain text — Meta compares the body byte for byte.
  return new Response(result.challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) {
    return jsonError(503, "META_APP_SECRET is not configured");
  }

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "Payload too large");
  }

  // An oversize body is refused without a WebhookFailure row — there is
  // nothing to replay, and recording it would store the flood.
  const raw = await readCappedBody(req);
  if (raw === null) return jsonError(413, "Payload too large");

  const verified = verifyMetaSignature({
    appSecret: secret,
    payload: raw,
    header: req.headers.get(META_SIGNATURE_HEADER),
  });
  if (!verified.ok) {
    console.warn(`[webhooks/meta] rejected a delivery: ${verified.reason}`);
    return jsonError(401, "Invalid signature");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    await noteFailure({
      externalId: null,
      // Truncated for display only — an unparseable body cannot be replayed
      // as an event anyway, so the panel just needs enough to diagnose it.
      payload: { raw: raw.slice(0, 4000) },
      error: "Malformed JSON body on a correctly signed request",
    });
    return json({ ok: false, outcomes: [] }, 200);
  }

  const events: MetaMessagingEvent[] = parseMetaWebhook(body);
  const outcomes: MetaIngestOutcome[] = [];
  let failed = false;

  // Sequential on purpose: two messages from the same new customer in one
  // delivery must not race each other into two customers and two enquiries.
  for (const event of events) {
    try {
      outcomes.push(await ingestMetaEvent(event));
    } catch (err) {
      failed = true;
      const error = err instanceof Error ? err.message : String(err);
      console.error("[webhooks/meta] processing failed:", err);
      // Per event, not per delivery: Retry then replays exactly what broke.
      await noteFailure({
        externalId: event.mid,
        payload: singleEventBody(event),
        error,
      });
    }
  }

  return json({ ok: !failed, outcomes }, 200);
}
