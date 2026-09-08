import { createHmac } from "node:crypto";
import { getConnection, type MetaConnection } from "../channel-connections";
import { recordOutbound } from "../enquiry-messages";
import type { EnquiryEmailContext } from "./email-outbound";
import {
  isWindowGraphError,
  isWithinSendWindow,
  metaGraphUrl,
  MetaWindowClosedError,
  splitOutboundText,
  type MetaChannelKind,
} from "./meta";

/**
 * Outbound Messenger + Instagram.
 *
 * Both channels are served by the PAGE's `/{page-id}/messages` endpoint with
 * the page access token; an Instagram send differs only in that the recipient
 * id is an IGSID. That is why an `instagram` ChannelConnection stores its
 * owning `pageId` — the IG business account id alone cannot route a send.
 */

const SEND_TIMEOUT_MS = 15_000;

/** Graph refused the send for a reason that is not the messaging window. */
export class MetaSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaSendError";
  }
}

export interface MetaReplyTarget {
  connection: MetaConnection;
  channel: MetaChannelKind;
  /** The customer's PSID / IGSID. */
  recipientId: string;
}

/**
 * Where a Meta reply would go, or null when this thread has no live Meta
 * route — a non-Meta last inbound, a message recorded before connections
 * existed, a disconnected Page, or a token that no longer decrypts. Null is
 * not an error: the caller falls back to email.
 */
export async function loadMetaReplyTarget(
  context: Pick<
    EnquiryEmailContext,
    "lastInboundChannel" | "lastInboundConnectionId" | "lastInboundFromAddress"
  >,
): Promise<MetaReplyTarget | null> {
  const channel = context.lastInboundChannel;
  if (channel !== "messenger" && channel !== "instagram") return null;
  if (!context.lastInboundConnectionId || !context.lastInboundFromAddress) {
    return null;
  }
  const connection = await getConnection(context.lastInboundConnectionId);
  if (!connection || !connection.active) return null;
  return {
    connection,
    channel,
    recipientId: context.lastInboundFromAddress,
  };
}

export interface MetaSentPart {
  text: string;
  messageId: string;
}

/**
 * How far a multi-part send got before it failed, stamped onto whatever error
 * comes out of `sendMetaMessage`. A long reply is several Graph calls: when
 * part two fails, part one is already on the customer's phone, and the caller
 * has to tell staff to send only the remainder rather than the whole thing
 * again. Read it with `partsSentFrom`.
 */
export interface MetaPartialSend {
  sentParts: number;
  totalParts: number;
}

function withPartCounts(err: unknown, sentParts: number, totalParts: number): unknown {
  if (typeof err === "object" && err !== null) {
    Object.assign(err, { sentParts, totalParts });
  }
  return err;
}

/** The counts `sendMetaMessage` stamped on an error, or zeroes. */
export function partsSentFrom(err: unknown): MetaPartialSend {
  const e = err as Partial<MetaPartialSend> | null;
  return {
    sentParts: typeof e?.sentParts === "number" ? e.sentParts : 0,
    totalParts: typeof e?.totalParts === "number" ? e.totalParts : 0,
  };
}

export interface SendMetaMessageInput {
  connection: MetaConnection;
  channel: MetaChannelKind;
  recipientId: string;
  text: string;
  /** When the customer last wrote — the 24-hour window is measured from it. */
  lastInboundAt: Date | null;
  now?: Date;
  fetchImpl?: typeof fetch;
  /** Where `META_APP_SECRET` is read from; injectable for tests. */
  env?: NodeJS.ProcessEnv;
  /**
   * Called after Graph accepts each part, before the next one goes out. A
   * long reply is several messages: when part two fails, part one is already
   * on the customer's phone, and this is how the caller gets to record it
   * instead of losing it with the error.
   */
  onPartSent?: (part: MetaSentPart) => void | Promise<void>;
}

interface GraphSendResponse {
  message_id?: unknown;
  error?: { message?: unknown; code?: unknown; error_subcode?: unknown };
}

/**
 * `appsecret_proof` — an HMAC of the access token keyed by the app secret.
 * With "require app secret proof" switched on, Graph rejects any call that
 * lacks it, which turns a stolen page token on its own into a dead credential.
 * It rides in the body with the token, never the query string.
 */
function appsecretProof(token: string, env: NodeJS.ProcessEnv): string | null {
  const secret = env.META_APP_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Send one reply, split across as many messages as the 2000-character limit
 * needs, and return each part with the `mid` Meta assigned it.
 *
 * The window is checked BEFORE the request: sending outside it is a policy
 * violation, and a rejected send still counts against the app. Graph's own
 * window rejection (code 10 / subcode 2018278, and 551 "user unavailable") is
 * mapped to the same error for the race where the window shuts between the
 * check and the request.
 *
 * The access token travels in the request BODY, never the URL: a query string
 * is written to proxy logs, browser history and error trackers.
 */
export async function sendMetaMessage(
  input: SendMetaMessageInput,
): Promise<MetaSentPart[]> {
  const now = input.now ?? new Date();
  if (!isWithinSendWindow(input.lastInboundAt, now)) {
    throw new MetaWindowClosedError(input.channel);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const env = input.env ?? process.env;
  const url = metaGraphUrl(`${input.connection.pageId}/messages`, env);
  const proof = appsecretProof(input.connection.accessToken, env);
  const parts = splitOutboundText(input.text);
  const sent: MetaSentPart[] = [];

  try {
    await sendParts({ input, parts, sent, url, proof, fetchImpl });
  } catch (err) {
    // Every throw below leaves the customer holding `sent.length` messages —
    // the caller needs that number to ask for the remainder, not a resend.
    throw withPartCounts(err, sent.length, parts.length);
  }

  return sent;
}

async function sendParts(args: {
  input: SendMetaMessageInput;
  parts: string[];
  sent: MetaSentPart[];
  url: string;
  proof: string | null;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const { input, parts, sent, url, proof, fetchImpl } = args;

  for (const text of parts) {
    let body: GraphSendResponse;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: { id: input.recipientId },
          messaging_type: "RESPONSE",
          message: { text },
          access_token: input.connection.accessToken,
          ...(proof ? { appsecret_proof: proof } : {}),
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      body = (await res.json()) as GraphSendResponse;
    } catch (err) {
      // Only the transport's own words: the request object holds the token.
      // A failure after part 1 has already gone out is NOT rolled back —
      // the customer has it, so `onPartSent` has already recorded it.
      throw new MetaSendError(
        `Meta send failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // The body is the verdict, whatever the status code: Graph answers 200
    // with an `error` object often enough that trusting `res.ok` would let a
    // refusal through as a successful send with no message id.
    if (body.error) {
      // Code 10 / subcode 2018278 / code 551 all live in `isWindowGraphError`.
      if (isWindowGraphError(body.error)) {
        throw new MetaWindowClosedError(input.channel);
      }
      // Only Graph's own message — never the request, which holds the token.
      const message =
        typeof body.error.message === "string"
          ? body.error.message
          : "unknown Graph error";
      throw new MetaSendError(`Meta refused the message: ${message}`);
    }

    const messageId =
      typeof body.message_id === "string" ? body.message_id : null;
    if (!messageId) {
      throw new MetaSendError("Meta returned no message id for the reply.");
    }
    const part = { text, messageId };
    sent.push(part);
    await input.onPartSent?.(part);
  }
}

export interface SendEnquiryMetaInput {
  context: EnquiryEmailContext;
  target: MetaReplyTarget;
  body: string;
  authorUserId: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}

/**
 * The staff reply, sent and threaded.
 *
 * ONE `EnquiryMessage` per part, each keyed by its own `mid`: Meta echoes
 * everything the API sends back to us, and `ingestMetaEvent` drops an echo
 * whose mid it already holds. Recording a two-part reply as a single row would
 * leave part two's echo unrecognised and re-recorded as a "Meta inbox"
 * message — one reply for the customer, three bubbles for staff.
 *
 * Each part is recorded as Graph accepts it rather than all of them at the
 * end, so a failure half way through leaves the thread showing exactly what
 * the customer actually received.
 */
export async function sendEnquiryMetaMessage(
  input: SendEnquiryMetaInput,
): Promise<{ messageIds: string[] }> {
  const parts = await sendMetaMessage({
    connection: input.target.connection,
    channel: input.target.channel,
    recipientId: input.target.recipientId,
    text: input.body,
    lastInboundAt: input.context.lastInboundAt,
    now: input.now,
    fetchImpl: input.fetchImpl,
    onPartSent: async (part) => {
      await recordOutbound({
        enquiryId: input.context.enquiryId,
        customerId: input.context.customerId,
        channel: input.target.channel,
        bodyText: part.text,
        fromAddress: input.target.recipientId,
        connectionId: input.target.connection.id,
        externalId: part.messageId,
        authorUserId: input.authorUserId,
        deliveryStatus: "sent",
      });
    },
  });

  return { messageIds: parts.map((p) => p.messageId) };
}
