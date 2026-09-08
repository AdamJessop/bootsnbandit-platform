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
import {
  MAX_WEBHOOK_BODY_BYTES,
  readCappedBody,
} from "../_lib/read-capped-body";

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
 * Wall-clock budget for ONE delivery. A delivery can carry many events, each
 * of which may fetch attachments; past this point the remaining events are
 * recorded as deferred failures and answered 200, because a POST Meta gives up
 * on is a delivery we lose entirely — a `WebhookFailure` with a Retry button
 * is strictly better than that.
 */
const DELIVERY_BUDGET_MS = 10_000;

const BUDGET_ERROR =
  "Deferred: the delivery exceeded its processing budget — press Retry.";

/**
 * Meta's `hub.challenge` is echoed back verbatim, so it is the one place a
 * caller controls our response body. It is a short number in practice; a cap
 * keeps this endpoint from being used as an arbitrary-content reflector.
 */
const MAX_CHALLENGE_CHARS = 512;

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
  if (result.challenge.length > MAX_CHALLENGE_CHARS) {
    console.warn("[webhooks/meta] rejected a verification: oversize challenge");
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
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
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

  const startedAt = Date.now();

  // Sequential on purpose: two messages from the same new customer in one
  // delivery must not race each other into two customers and two enquiries.
  for (const event of events) {
    // Checked BEFORE each event, never mid-event: a half-processed message is
    // worse than a deferred one. What is left becomes a replayable failure.
    if (Date.now() - startedAt > DELIVERY_BUDGET_MS) {
      failed = true;
      console.warn(
        `[webhooks/meta] deferred ${event.mid ?? "an event"} — delivery budget spent`,
      );
      await noteFailure({
        externalId: event.mid,
        payload: singleEventBody(event),
        error: BUDGET_ERROR,
      });
      continue;
    }
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
