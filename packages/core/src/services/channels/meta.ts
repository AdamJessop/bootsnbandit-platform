import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pure half of the Meta channel (Messenger + Instagram Messaging): request
 * verification, webhook parsing, the attachment host allow-list, the outbound
 * text splitter and the 24-hour messaging window.
 *
 * No Prisma, no network, no env beyond META_GRAPH_VERSION — so every rule here
 * is provable with a string and a JSON fixture.
 */

// ---------------------------------------------------------------------------
// Request verification
// ---------------------------------------------------------------------------

export const META_SIGNATURE_HEADER = "x-hub-signature-256";

/** `sha256=<hex>` over the RAW body, exactly as Meta computes it. */
export function signMetaPayload(appSecret: string, payload: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(payload, "utf8").digest("hex")}`;
}

export type MetaVerification =
  | { ok: true }
  | { ok: false; reason: "no_secret" | "missing_header" | "bad_format" | "no_match" };

const HEX_64 = /^[0-9a-f]{64}$/i;

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * The body MUST be the raw request text. JSON.parse/stringify round-tripping
 * changes bytes (key order, whitespace, unicode escapes) and breaks the HMAC.
 */
export function verifyMetaSignature(input: {
  appSecret: string;
  payload: string;
  header: string | null | undefined;
}): MetaVerification {
  if (!input.appSecret) return { ok: false, reason: "no_secret" };
  const header = input.header?.trim();
  if (!header) return { ok: false, reason: "missing_header" };
  // Deliberately case-SENSITIVE: Meta sends exactly `sha256=`, so accepting
  // `SHA256=` would only ever widen what we treat as a signed request.
  if (!header.startsWith("sha256=")) return { ok: false, reason: "bad_format" };
  const digest = header.slice("sha256=".length);
  // Checked before comparing so a malformed header is reported as malformed
  // rather than as a mismatch — the two mean very different things to whoever
  // is reading the log while wiring the webhook up.
  if (!HEX_64.test(digest)) return { ok: false, reason: "bad_format" };
  const expected = signMetaPayload(input.appSecret, input.payload).slice(
    "sha256=".length,
  );
  return constantTimeEquals(digest.toLowerCase(), expected)
    ? { ok: true }
    : { ok: false, reason: "no_match" };
}

export type HubChallengeResult =
  | { ok: true; challenge: string }
  | { ok: false; reason: "not_configured" | "bad_mode" | "bad_token" | "no_challenge" };

/**
 * Meta's subscription handshake: GET with `hub.mode=subscribe`, our
 * `hub.verify_token` and a `hub.challenge` we must echo back verbatim as
 * text/plain. The token comparison is constant-time — it is a shared secret
 * an attacker can probe as often as they like.
 */
export function verifyHubChallenge(
  params: URLSearchParams,
  verifyToken: string | null | undefined,
): HubChallengeResult {
  const configured = verifyToken?.trim();
  if (!configured) return { ok: false, reason: "not_configured" };
  if (params.get("hub.mode") !== "subscribe") {
    return { ok: false, reason: "bad_mode" };
  }
  if (!constantTimeEquals(params.get("hub.verify_token") ?? "", configured)) {
    return { ok: false, reason: "bad_token" };
  }
  const challenge = params.get("hub.challenge");
  if (!challenge) return { ok: false, reason: "no_challenge" };
  return { ok: true, challenge };
}

// ---------------------------------------------------------------------------
// Webhook parsing
// ---------------------------------------------------------------------------

export type MetaChannelKind = "messenger" | "instagram";

export interface MetaAttachment {
  /** Meta's own type word: image | video | audio | file | share | … */
  type: string;
  url: string | null;
}

export interface MetaMessagingEvent {
  object: "page" | "instagram";
  channel: MetaChannelKind;
  /** entry.id — the Page id (page) or IG business account id (instagram). */
  entryId: string;
  entryTime: number;
  senderId: string;
  recipientId: string;
  /**
   * The CUSTOMER's PSID/IGSID. Normally the sender; on an echo (staff replied
   * from the Meta inbox) the sender is our own Page, so it is the recipient.
   */
  customerId: string;
  timestamp: Date;
  mid: string | null;
  text: string | null;
  isEcho: boolean;
  attachments: MetaAttachment[];
  kind: "message" | "postback" | "receipt" | "unknown";
  /** The original `messaging[i]` object, kept so a failure can be replayed. */
  raw: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseAttachments(value: unknown): MetaAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: MetaAttachment[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const att = item as { type?: unknown; payload?: { url?: unknown } };
    const type = str(att.type);
    if (!type) continue;
    out.push({ type, url: str(att.payload?.url) });
  }
  return out;
}

/**
 * Flatten a webhook body into one normalised event per `entry[].messaging[]`
 * item. Total tolerance for junk: anything unrecognised is skipped, never
 * thrown — an unauthenticated endpoint must not be able to raise an exception
 * from a payload. `entry[].changes[]` (feed/comment events) is not parsed:
 * we subscribe only to messaging fields.
 */
export function parseMetaWebhook(body: unknown): MetaMessagingEvent[] {
  if (typeof body !== "object" || body === null) return [];
  const root = body as { object?: unknown; entry?: unknown };
  const object = root.object;
  if (object !== "page" && object !== "instagram") return [];
  if (!Array.isArray(root.entry)) return [];

  const channel: MetaChannelKind =
    object === "instagram" ? "instagram" : "messenger";
  const events: MetaMessagingEvent[] = [];

  for (const rawEntry of root.entry) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const entry = rawEntry as {
      id?: unknown;
      time?: unknown;
      messaging?: unknown;
    };
    const entryId = str(entry.id);
    if (!entryId || !Array.isArray(entry.messaging)) continue;
    const entryTime = typeof entry.time === "number" ? entry.time : 0;

    for (const raw of entry.messaging) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as {
        sender?: { id?: unknown };
        recipient?: { id?: unknown };
        timestamp?: unknown;
        message?: {
          mid?: unknown;
          text?: unknown;
          is_echo?: unknown;
          attachments?: unknown;
        };
        postback?: { mid?: unknown };
        delivery?: unknown;
        read?: unknown;
      };
      const senderId = str(item.sender?.id);
      const recipientId = str(item.recipient?.id);
      if (!senderId || !recipientId) continue;

      const kind: MetaMessagingEvent["kind"] = item.message
        ? "message"
        : item.postback
          ? "postback"
          : item.delivery || item.read
            ? "receipt"
            : "unknown";

      const isEcho = item.message?.is_echo === true;
      // Meta's `timestamp` and `entry.time` are MILLISECONDS since the epoch,
      // not seconds — `new Date(ms)` below depends on that. A seconds value
      // would land in 1970 and quietly break the 24-hour window.
      const ms =
        typeof item.timestamp === "number" ? item.timestamp : entryTime;

      events.push({
        object,
        channel,
        entryId,
        entryTime,
        senderId,
        recipientId,
        customerId: isEcho ? recipientId : senderId,
        timestamp: new Date(ms || Date.now()),
        mid: str(item.message?.mid) ?? str(item.postback?.mid),
        text: str(item.message?.text),
        isEcho,
        attachments: parseAttachments(item.message?.attachments),
        kind,
        raw,
      });
    }
  }

  return events;
}

/**
 * The smallest webhook body that replays exactly this one event. A delivery
 * can carry many events and only one of them may have failed, so the stored
 * `WebhookFailure.payload` is this — not the whole batch — and pressing Retry
 * re-runs precisely what broke.
 */
export function singleEventBody(event: MetaMessagingEvent): unknown {
  return {
    object: event.object,
    entry: [
      { id: event.entryId, time: event.entryTime, messaging: [event.raw] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Attachment host allow-list (SSRF)
// ---------------------------------------------------------------------------

/**
 * Attachment URLs arrive INSIDE a webhook body. The body is signed, so it came
 * from Meta — but the payload URL is still a value we are about to fetch
 * server-side, and a signed-but-hostile or simply changed API would otherwise
 * point us at `http://169.254.169.254/` or an internal service. Only Meta's
 * own media hosts are ever fetched; anything else is stored as a link for
 * staff to open in a browser, which is the right blast radius for it.
 */
export const META_ATTACHMENT_HOST_SUFFIXES = [
  ".fbcdn.net",
  ".cdninstagram.com",
] as const;

export const META_ATTACHMENT_HOSTS = ["lookaside.fbsbx.com"] as const;

export function isAllowedMetaAttachmentUrl(
  url: string | null | undefined,
): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // https only, no credentials, no odd port: each of those is a way to reach
  // something that is not the CDN while still "looking like" the CDN.
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "443") return false;
  const host = parsed.hostname.toLowerCase();
  if (META_ATTACHMENT_HOSTS.includes(host as (typeof META_ATTACHMENT_HOSTS)[number])) {
    return true;
  }
  // The leading dot matters: it makes this a subdomain test, so `notfbcdn.net`
  // and `fbcdn.net.evil.test` both fail.
  return META_ATTACHMENT_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

// ---------------------------------------------------------------------------
// Outbound text
// ---------------------------------------------------------------------------

/** Meta rejects a message body over 2000 characters outright. */
export const MAX_META_MESSAGE_CHARS = 2000;

/**
 * Split a long reply into consecutive messages. Prefers a newline, then a
 * space, then a hard cut — a 3000-character reply arriving as two readable
 * halves beats a 400 from Graph and nothing sent at all.
 */
export function splitOutboundText(
  text: string,
  limit: number = MAX_META_MESSAGE_CHARS,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= limit) return [trimmed];

  const out: string[] = [];
  let rest = trimmed;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = window.lastIndexOf("\n");
    // Only honour a boundary in the back half; a break at character 3 of 2000
    // would produce a stream of tiny messages.
    if (cut < limit / 2) cut = window.lastIndexOf(" ");
    if (cut < limit / 2) cut = limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// ---------------------------------------------------------------------------
// Graph endpoint
// ---------------------------------------------------------------------------

export const DEFAULT_META_GRAPH_VERSION = "v21.0";
const GRAPH_VERSION = /^v\d{1,3}\.\d{1,3}$/;
const warnedVersions = new Set<string>();

/**
 * Pinned by default, overridable when Meta deprecates a version. Validated
 * because the value is interpolated into a URL path — an unchecked env var
 * there is a path-traversal primitive.
 */
export function metaGraphVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.META_GRAPH_VERSION?.trim();
  if (!raw) return DEFAULT_META_GRAPH_VERSION;
  if (GRAPH_VERSION.test(raw)) return raw;
  if (!warnedVersions.has(raw)) {
    warnedVersions.add(raw);
    console.warn(
      `[meta] META_GRAPH_VERSION is not a version (${raw}) — using ${DEFAULT_META_GRAPH_VERSION}. Expected e.g. v21.0.`,
    );
  }
  return DEFAULT_META_GRAPH_VERSION;
}

export function metaGraphUrl(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `https://graph.facebook.com/${metaGraphVersion(env)}/${path.replace(/^\//, "")}`;
}

// ---------------------------------------------------------------------------
// The 24-hour messaging window
// ---------------------------------------------------------------------------

export const META_SEND_WINDOW_MS = 86_400_000;

/**
 * Meta only allows a business to message a person within 24 hours of that
 * person's last message. Sending outside it is a policy violation, not a
 * transient error, so it is caught BEFORE the request goes out and surfaced
 * to staff as "email them instead".
 */
export class MetaWindowClosedError extends Error {
  readonly channel: MetaChannelKind;
  constructor(channel: MetaChannelKind) {
    super(
      "Messenger/Instagram only allows replies within 24 hours of the customer's last message — email them instead.",
    );
    this.name = "MetaWindowClosedError";
    this.channel = channel;
  }
}

export function isWithinSendWindow(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < META_SEND_WINDOW_MS;
}

/**
 * "This person isn't available right now" — Graph's other way of saying the
 * conversation is not open to us. It belongs with the window errors: the same
 * advice ("email them instead") is the only thing staff can do about it.
 */
export const META_USER_UNAVAILABLE_CODE = 551;

/**
 * Graph's own verdict, for the race where the window shut between our check
 * and the request: code 10 ("permission denied" — the family the messaging
 * window lives in), code 551 (user unavailable) or subcode 2018278 ("outside
 * allowed window").
 */
export function isWindowGraphError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: unknown; error_subcode?: unknown };
  return (
    err.code === 10 ||
    err.code === META_USER_UNAVAILABLE_CODE ||
    err.error_subcode === 2018278
  );
}
