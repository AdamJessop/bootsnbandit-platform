import { createHmac } from "node:crypto";
import { prisma } from "@bnb/core/db";
import { sniffImageMime } from "@bnb/core/uploads";
import {
  MAX_INLINE_ATTACHMENT_BYTES,
  type StoreAttachmentInput,
} from "../assets";
import {
  lookupConnectionByExternalId,
  touchConnectionEvent,
  type MetaConnection,
} from "../channel-connections";
import { findOrCreateCustomer } from "../contact-identity";
import { recordInbound, recordOutbound } from "../enquiry-messages";
import { notifyOwnersOfNewEnquiry } from "../enquiry-alerts";
import { resolveThread } from "../enquiry-threading";
import {
  isAllowedMetaAttachmentUrl,
  metaGraphUrl,
  type MetaChannelKind,
  type MetaMessagingEvent,
} from "./meta";

/**
 * The single inbound Meta orchestration: connection → idempotency → identity →
 * thread → message. The webhook route and the Studio › Channels retry button
 * both call exactly this, so replaying a stored event behaves identically to
 * the original delivery.
 *
 * Errors are NOT swallowed here — the caller turns them into a WebhookFailure
 * row so the failure is visible and replayable.
 */

/** Cap on attachments processed per message — a flood must not stall the route. */
export const MAX_META_ATTACHMENTS = 10;

/** Total bytes one message may pull into inline attachment rows. */
export const MAX_META_INLINE_TOTAL_BYTES = 16 * 1024 * 1024;

/**
 * Hard ceiling on how long a single attachment download may take. Well under
 * the webhook route's own delivery budget: several of these in a row must not
 * be able to hold a POST open past the point Meta gives up on it.
 */
const DOWNLOAD_TIMEOUT_MS = 8_000;

/**
 * Wall-clock budget for ALL the attachment downloads of ONE message. Once it
 * is spent, whatever is left becomes a link instead — the URL is still on the
 * thread, and a link beats losing the message to a timed-out delivery.
 */
export const MAX_ATTACHMENT_WALL_MS = 8_000;

/** A Meta user carries no email or phone — this is the best name we have. */
export const UNKNOWN_SENDER_NAME: Record<MetaChannelKind, string> = {
  messenger: "Messenger user",
  instagram: "Instagram user",
};

/** Attribution for a staff reply typed into Meta's own inbox, not ours. */
export const META_INBOX_AUTHOR = "Meta inbox";

export interface MetaProfile {
  name: string | null;
}

export interface MetaInboundDeps {
  fetchProfile(input: {
    connection: MetaConnection;
    userId: string;
    channel: MetaChannelKind;
  }): Promise<MetaProfile | null>;
  /** Resolves null when the body is missing, too large or unreadable. */
  download(url: string, maxBytes: number): Promise<Uint8Array | null>;
  /** Monotonic-ish milliseconds; injectable so a budget is testable. */
  now?(): number;
}

function fullName(first: unknown, last: unknown): string | null {
  const parts = [first, last].filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return parts.length ? parts.join(" ").trim() : null;
}

/**
 * Meta's proof-of-app-secret: an HMAC of the access token keyed by the app
 * secret, binding a stolen token to our app so it cannot be replayed from
 * anywhere else. A derived digest, never the token itself — so unlike the
 * token it is safe in the query string, the only place Graph takes it on GET.
 */
function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

/**
 * The real network deps. Only ever constructed on the webhook/retry path.
 * `fetchImpl` defaults to the global fetch; tests inject their own so no suite
 * ever touches the network.
 *
 * The page token goes in the `Authorization` header, never a query string:
 * query strings land in proxy and access logs.
 */
export function metaInboundDeps(
  fetchImpl: typeof fetch = fetch,
  appSecret: string | undefined = process.env.META_APP_SECRET,
): MetaInboundDeps {
  return {
    now: () => Date.now(),

    async fetchProfile({ connection, userId, channel }) {
      const fields =
        channel === "instagram" ? "name,username" : "first_name,last_name";
      const proof = appSecret?.trim()
        ? `&appsecret_proof=${appSecretProof(connection.accessToken, appSecret.trim())}`
        : "";
      try {
        const res = await fetchImpl(
          metaGraphUrl(`${encodeURIComponent(userId)}?fields=${fields}${proof}`),
          {
            headers: { authorization: `Bearer ${connection.accessToken}` },
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
          },
        );
        if (!res.ok) return null;
        const body = (await res.json()) as {
          name?: unknown;
          username?: unknown;
          first_name?: unknown;
          last_name?: unknown;
        };
        const name =
          fullName(body.first_name, body.last_name) ??
          (typeof body.name === "string" && body.name.trim() ? body.name.trim() : null) ??
          (typeof body.username === "string" && body.username.trim()
            ? body.username.trim()
            : null);
        return { name };
      } catch (err) {
        // A profile is a nicety; the message is the point. Never fatal.
        console.error(`[meta] profile fetch failed for ${userId}:`, err);
        return null;
      }
    },

    async download(url, maxBytes) {
      try {
        const res = await fetchImpl(url, {
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const declared = Number(res.headers.get("content-length") ?? "0");
        if (declared > maxBytes) return null;
        if (!res.body) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          return bytes.byteLength > 0 && bytes.byteLength <= maxBytes
            ? bytes
            : null;
        }
        // Content-Length can be absent or lie, so the cap is enforced on the
        // bytes actually seen — the reader is cancelled the instant the
        // running total crosses maxBytes, never buffering an unbounded body.
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        if (total === 0) return null;
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes;
      } catch {
        return null;
      }
    },
  };
}

export type MetaIngestOutcome =
  | {
      status: "recorded";
      direction: "inbound" | "outbound";
      enquiryId: string;
      messageId: string;
      createdEnquiry: boolean;
    }
  | { status: "duplicate"; enquiryId: string; messageId: string }
  | {
      status: "ignored";
      reason: "echo_known" | "no_message" | "unsupported" | "unknown_page";
    };

/**
 * Images become inline rows, everything else a link.
 *
 * Two hard rules, both carried from earlier phases:
 *   - the URL must be one of Meta's own CDN hosts before we fetch it at all
 *     (`isAllowedMetaAttachmentUrl`); anything else is a link, never a fetch;
 *   - bytes are stored ONLY when `sniffImageMime` recognises them, and the row
 *     records the SNIFFED mime — an `image` label on an SVG or an HTML payload
 *     must not end up served back to staff as an image.
 */
async function collectAttachments(
  event: MetaMessagingEvent,
  deps: MetaInboundDeps,
): Promise<StoreAttachmentInput[]> {
  const out: StoreAttachmentInput[] = [];
  let spent = 0;
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();

  for (const attachment of event.attachments.slice(0, MAX_META_ATTACHMENTS)) {
    const url = attachment.url;
    const remaining = MAX_META_INLINE_TOTAL_BYTES - spent;
    // Bytes AND time: a message full of slow attachments must not be able to
    // hold the webhook POST open. Past the budget the rest are links.
    const wantsBytes =
      attachment.type === "image" &&
      isAllowedMetaAttachmentUrl(url) &&
      remaining > 0 &&
      now() - startedAt < MAX_ATTACHMENT_WALL_MS;

    if (wantsBytes && url) {
      let downloaded: Uint8Array | null = null;
      try {
        downloaded = await deps.download(
          url,
          Math.min(MAX_INLINE_ATTACHMENT_BYTES, remaining),
        );
      } catch (err) {
        console.error(`[meta] attachment download failed for ${url}:`, err);
      }
      // Charged whether or not the bytes end up stored — a failed sniff still
      // cost the transfer.
      spent += downloaded
        ? downloaded.byteLength
        : Math.min(MAX_INLINE_ATTACHMENT_BYTES, remaining);
      const sniffed = downloaded ? sniffImageMime(downloaded) : null;
      if (downloaded && sniffed) {
        out.push({ mime: sniffed, filename: null, bytes: downloaded });
        continue;
      }
    }

    if (url) {
      out.push({ mime: "application/octet-stream", filename: null, url });
    }
    // else: no url and no bytes — unreachable in the inbox, so not written.
  }

  return out;
}

/** Never leave a bubble blank: say what arrived when there are no words. */
function bodyTextFor(event: MetaMessagingEvent): string | null {
  const text = event.text?.trim();
  if (text) return text;
  // Capped the same way `collectAttachments` caps: the sentence must describe
  // the rows staff will actually see, not what arrived and was dropped.
  const n = Math.min(event.attachments.length, MAX_META_ATTACHMENTS);
  if (n === 1) return "(sent an attachment)";
  if (n > 1) return `(sent ${n} attachments)`;
  return null;
}

/** Liveness for the Channels panel — never worth losing a message over. */
async function touch(connectionId: string, at: Date): Promise<void> {
  try {
    await touchConnectionEvent(connectionId, at);
  } catch (err) {
    console.error(`[meta] could not touch connection ${connectionId}:`, err);
  }
}

export async function ingestMetaEvent(
  event: MetaMessagingEvent,
  deps: MetaInboundDeps = metaInboundDeps(),
): Promise<MetaIngestOutcome> {
  // Delivery/read receipts and postbacks are not conversation. Postbacks are
  // deliberately out of scope for this phase: we ship no menu or Get Started
  // button, so a postback can only be Meta's own default entry point.
  if (event.kind !== "message") {
    return { status: "ignored", reason: "unsupported" };
  }

  // No mid means no idempotency key — a retry would double-post it.
  if (!event.mid) return { status: "ignored", reason: "no_message" };
  const bodyText = bodyTextFor(event);
  if (!bodyText) return { status: "ignored", reason: "no_message" };

  // `entry.id` is the Page id (messenger) or the IG account id (instagram);
  // either way it is the connection's externalId. No connection means this
  // app is subscribed to a Page this studio never connected — not our traffic.
  const lookup = await lookupConnectionByExternalId(event.entryId);
  if (lookup.kind === "none") {
    // Logged, not silent: "this app is subscribed to a Page we never connected"
    // is a real misconfiguration, and it is otherwise indistinguishable from
    // "nothing is arriving at all".
    console.warn(
      `[meta] ignoring an event for an unconnected destination: entry ${event.entryId}, mid ${event.mid}`,
    );
    return { status: "ignored", reason: "unknown_page" };
  }
  if (lookup.kind === "unreadable") {
    // NOT `unknown_page`: the Page IS connected, its credential just cannot be
    // read (SESSION_SECRET rotated, row corrupted). Throwing makes the route
    // write a replayable WebhookFailure instead of dropping real customer
    // traffic while the panel still says Connected.
    throw new Error(
      `Connection ${lookup.row.id} has an unreadable access token — reconnect the Page in Studio › Channels`,
    );
  }
  const connection = lookup.connection;

  const existing = await prisma.enquiryMessage.findUnique({
    where: { externalId: event.mid },
    select: { id: true, enquiryId: true },
  });
  if (existing) {
    // An echo we already hold is OUR OWN send coming back around — there is
    // nothing to record and nothing was duplicated, and nothing arrived from
    // the customer, so it is not a liveness signal either. A non-echo we
    // already hold is a replayed delivery of real customer traffic: no second
    // row, but the connection did just receive something.
    if (event.isEcho) return { status: "ignored", reason: "echo_known" };
    await touch(connection.id, event.timestamp);
    return {
      status: "duplicate",
      enquiryId: existing.enquiryId,
      messageId: existing.id,
    };
  }

  await touch(connection.id, event.timestamp);

  // A handle we already know needs no Graph call — profile fetches are rate
  // limited and this runs on every single message.
  const known = await prisma.customerIdentity.findUnique({
    where: {
      channel_externalId: {
        channel: event.channel,
        externalId: event.customerId,
      },
    },
    select: { customerId: true, displayName: true },
  });
  // The name is a nicety; the message is the point. The default deps swallow
  // their own failures, but an injected one need not — and Graph being down
  // must never cost us a customer's message.
  let profile: MetaProfile | null = known ? { name: known.displayName } : null;
  if (!known) {
    try {
      profile = await deps.fetchProfile({
        connection,
        userId: event.customerId,
        channel: event.channel,
      });
    } catch (err) {
      console.error(`[meta] profile lookup failed for ${event.customerId}:`, err);
    }
  }
  const displayName = profile?.name?.trim() || UNKNOWN_SENDER_NAME[event.channel];

  const customer = await findOrCreateCustomer({
    name: displayName,
    // The identity row was just read above; handing over the customer it names
    // saves the resolver reading exactly the same row again.
    identityCustomerId: known?.customerId ?? null,
    identity: {
      channel: event.channel,
      externalId: event.customerId,
      displayName,
    },
  });

  const thread = await resolveThread({
    customerId: customer.id,
    channel: event.channel,
    // Meta carries no reply token — there is no header for us to put one in.
    // Threading falls through to the recent-open rule, then a new enquiry.
    threadToken: null,
    contactName: displayName || customer.name,
    contactPhone: customer.phone,
    now: event.timestamp,
  });

  const attachments = await collectAttachments(event, deps);
  const shared = {
    enquiryId: thread.enquiryId,
    customerId: customer.id,
    channel: event.channel,
    bodyText,
    fromAddress: event.customerId,
    externalId: event.mid,
    connectionId: connection.id,
    attachments,
    at: event.timestamp,
  };

  // An echo whose mid we have never seen is a staff reply typed into Meta's
  // own inbox. It belongs on the thread as OUTBOUND, with no author user —
  // we genuinely do not know which staff member sent it.
  const row = event.isEcho
    ? await recordOutbound({
        ...shared,
        authorUserId: null,
        fromName: META_INBOX_AUTHOR,
        deliveryStatus: "sent",
      })
    : await recordInbound({ ...shared, fromName: displayName });

  // `row.enquiryId`, not `thread.enquiryId`: when two deliveries of the same
  // event race, both can resolve a thread before either writes, and the loser
  // gets the winner's row back. The loser also freshly created an Enquiry that
  // now holds no message — clean it up. The `messages: none` guard makes this
  // a no-op unless this call actually lost.
  if (thread.created && row.enquiryId !== thread.enquiryId) {
    await prisma.enquiry.deleteMany({
      where: { id: thread.enquiryId, messages: { none: {} } },
    });
  }

  const createdEnquiry = thread.created && row.enquiryId === thread.enquiryId;
  // A customer opening a fresh thread is a new enquiry — tell the owners. An
  // echo is staff typing in Meta's own inbox, so there is nothing to tell.
  // Fire-and-forget: it never rejects, and the webhook must not wait on it.
  if (createdEnquiry && !event.isEcho) {
    void notifyOwnersOfNewEnquiry({
      enquiryId: row.enquiryId,
      customerName: displayName || customer.name,
      channel: event.channel,
      summary: bodyText,
    });
  }

  return {
    status: "recorded",
    direction: event.isEcho ? "outbound" : "inbound",
    enquiryId: row.enquiryId,
    messageId: row.id,
    createdEnquiry,
  };
}
