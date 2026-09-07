import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks (Svix) signature verification — the scheme Resend uses.
 *
 *   signature = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`))
 *   header    = "v1,<sig>" (space-separated when a secret is being rotated)
 *
 * Implemented here rather than pulled in:
 *   - `svix` is not installed and this is ~40 lines of HMAC;
 *   - `standardwebhooks` exists only as a transitive dep of `resend` and must
 *     not be imported directly (npm may dedupe it away);
 *   - `resend.webhooks.verify` needs a `Resend` instance, and the constructor
 *     throws without RESEND_API_KEY — signature checking must not depend on
 *     the send key. (An interop test proves we agree with it anyway.)
 *
 * The body must be the RAW request text: JSON.parse/stringify round-tripping
 * changes bytes and breaks the signature.
 */

/** Replay window either side of the signed timestamp. Matches Svix's default. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SignatureHeaders =
  | Headers
  | Record<string, string | string[] | null | undefined>;

function readHeader(headers: SignatureHeaders, name: string): string | null {
  // Defensive: real callers (an inbound HTTP route) may pass a nullish or
  // otherwise malformed value at runtime despite the declared type — this
  // must resolve to "missing_headers", never throw.
  if (headers == null) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(
    headers as Record<string, string | string[] | null | undefined>,
  )) {
    if (key.toLowerCase() !== wanted) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}

/** Svix's own header names, with the vendor-neutral aliases as a fallback. */
function signatureHeaders(headers: SignatureHeaders): {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
} {
  return {
    id: readHeader(headers, "svix-id") ?? readHeader(headers, "webhook-id"),
    timestamp:
      readHeader(headers, "svix-timestamp") ??
      readHeader(headers, "webhook-timestamp"),
    signature:
      readHeader(headers, "svix-signature") ??
      readHeader(headers, "webhook-signature"),
  };
}

/**
 * Signing secrets are `whsec_<base64>`. The prefix is stripped and the rest
 * base64-decoded — exactly what the reference implementation does, so our
 * signatures match theirs. A secret that is not base64 falls back to its raw
 * bytes rather than silently keying on nothing.
 */
function secretKey(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const decoded = Buffer.from(raw, "base64");
  return decoded.length > 0 ? decoded : Buffer.from(raw, "utf8");
}

export interface SignWebhookInput {
  secret: string;
  id: string;
  timestamp: Date | number;
  payload: string;
}

/** `v1,<base64>` — exported so tests and the local runbook can sign payloads. */
export function signWebhookPayload(input: SignWebhookInput): string {
  const seconds =
    typeof input.timestamp === "number"
      ? Math.floor(input.timestamp)
      : Math.floor(input.timestamp.getTime() / 1000);
  const mac = createHmac("sha256", secretKey(input.secret));
  mac.update(`${input.id}.${seconds}.${input.payload}`, "utf8");
  return `v1,${mac.digest("base64")}`;
}

export interface VerifyWebhookInput {
  secret: string;
  /** The RAW body text, exactly as received. */
  payload: string;
  headers: SignatureHeaders;
  now?: Date;
  toleranceSeconds?: number;
}

export type WebhookVerification =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_secret"
        | "missing_headers"
        | "bad_timestamp"
        | "timestamp_too_old"
        | "timestamp_too_new"
        | "no_matching_signature";
    };

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyWebhookSignature(
  input: VerifyWebhookInput,
): WebhookVerification {
  if (!input.secret) return { ok: false, reason: "no_secret" };

  const { id, timestamp, signature } = signatureHeaders(input.headers);
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing_headers" };
  }

  const seconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(seconds)) return { ok: false, reason: "bad_timestamp" };

  const tolerance = input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS;
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (now - seconds > tolerance) return { ok: false, reason: "timestamp_too_old" };
  if (seconds - now > tolerance) return { ok: false, reason: "timestamp_too_new" };

  const expected = signWebhookPayload({
    secret: input.secret,
    id,
    timestamp: seconds,
    payload: input.payload,
  }).slice("v1,".length);

  for (const candidate of signature.split(" ")) {
    const [version, value] = candidate.split(",");
    if (version !== "v1" || !value) continue;
    if (constantTimeEquals(value, expected)) return { ok: true };
  }
  return { ok: false, reason: "no_matching_signature" };
}
