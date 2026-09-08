import { prisma } from "@bnb/core/db";
import { decryptSecret, encryptSecret } from "./secrets";

/**
 * `ChannelConnection` CRUD, and the one and only place a page token is
 * encrypted or decrypted.
 *
 * Two shapes on purpose:
 *   ChannelConnectionRow — no token. Everything a screen renders.
 *   MetaConnection       — row + decrypted token. Only the send path and the
 *                          Graph calls ask for it.
 */

export type MetaChannel = "messenger" | "instagram";

export interface ChannelConnectionRow {
  id: string;
  channel: MetaChannel;
  externalId: string;
  pageId: string;
  igAccountId: string | null;
  name: string;
  active: boolean;
  webhookSubscribedAt: Date | null;
  lastEventAt: Date | null;
  connectedAt: Date;
  /**
   * Whether the stored token still decrypts under the current SESSION_SECRET.
   * The panel needs to distinguish "connected" from "connected but the
   * credential is unusable" — the row looks identical otherwise, while every
   * send and every inbound event silently fails. Never the token itself.
   */
  tokenReadable: boolean;
}

export interface MetaConnection extends ChannelConnectionRow {
  /** Decrypted page access token. Never render it, never log it. */
  accessToken: string;
}

const ROW_SELECT = {
  id: true,
  channel: true,
  externalId: true,
  pageId: true,
  igAccountId: true,
  name: true,
  active: true,
  webhookSubscribedAt: true,
  lastEventAt: true,
  connectedAt: true,
} as const;

interface RawRow {
  id: string;
  channel: string;
  externalId: string;
  pageId: string;
  igAccountId: string | null;
  name: string;
  active: boolean;
  webhookSubscribedAt: Date | null;
  lastEventAt: Date | null;
  connectedAt: Date;
}

function toRow(raw: RawRow, tokenReadable: boolean): ChannelConnectionRow {
  return { ...raw, channel: raw.channel as MetaChannel, tokenReadable };
}

/** Does this envelope still open? Never returns (or logs) the plaintext. */
function canDecrypt(envelope: string): boolean {
  try {
    decryptSecret(envelope);
    return true;
  } catch {
    return false;
  }
}

export interface UpsertChannelConnectionInput {
  channel: MetaChannel;
  externalId: string;
  pageId: string;
  igAccountId?: string | null;
  name: string;
  /** PLAINTEXT token; encrypted before it reaches the database. */
  accessToken: string;
  webhookSubscribedAt?: Date | null;
}

/**
 * Connect (or re-connect) one Page / IG account. Re-connecting is the normal
 * repair path — a token expired, permissions changed — so it replaces the
 * token, refreshes the name, and always sets `active` back to true.
 */
export async function upsertChannelConnection(
  input: UpsertChannelConnectionInput,
): Promise<ChannelConnectionRow> {
  const shared = {
    channel: input.channel,
    pageId: input.pageId,
    igAccountId: input.igAccountId ?? null,
    name: input.name,
    accessToken: encryptSecret(input.accessToken),
    active: true,
    ...(input.webhookSubscribedAt !== undefined
      ? { webhookSubscribedAt: input.webhookSubscribedAt }
      : {}),
  };
  const row = await prisma.channelConnection.upsert({
    where: { externalId: input.externalId },
    create: { externalId: input.externalId, ...shared },
    // Re-connecting restarts the health clock. It is the repair the panel
    // asks for, so leaving `connectedAt` at the original connection would
    // keep "nothing received for N days" on screen immediately after the
    // owner has done exactly what it told them to do.
    update: { ...shared, connectedAt: new Date() },
    select: ROW_SELECT,
  });
  // Just encrypted with the running key, so it reads back by construction.
  return toRow(row as RawRow, true);
}

/**
 * Everything the Channels panel lists. The token column is read ONLY to answer
 * "does this still decrypt?" — the plaintext never leaves this function, and
 * the returned shape has no field to put it in.
 */
export async function listChannelConnections(): Promise<ChannelConnectionRow[]> {
  const rows = await prisma.channelConnection.findMany({
    orderBy: [{ connectedAt: "desc" }, { id: "desc" }],
    select: { ...ROW_SELECT, accessToken: true },
  });
  return rows.map((row) => {
    const { accessToken, ...rest } = row as RawRow & { accessToken: string };
    return toRow(rest, canDecrypt(accessToken));
  });
}

/**
 * A token that will not decrypt (SESSION_SECRET rotated, row corrupted) is
 * reported as "no usable connection" rather than thrown: an inbound webhook
 * must not 500 because a credential went stale, and `listChannelConnections`
 * still shows the row so the owner is told to reconnect.
 */
function withToken(
  raw: (RawRow & { accessToken: string }) | null,
): MetaConnection | null {
  if (!raw) return null;
  const { accessToken, ...rest } = raw;
  try {
    return { ...toRow(rest, true), accessToken: decryptSecret(accessToken) };
  } catch (err) {
    console.error(
      `[channels] connection ${raw.id} has an unreadable access token — reconnect the Page:`,
      err,
    );
    return null;
  }
}

/**
 * The three answers a lookup can honestly give.
 *
 * `none` and `unreadable` are NOT the same thing, and collapsing them to null
 * is how a rotated SESSION_SECRET turns every inbound Meta message into a
 * silently ignored "unknown page" while the panel still says Connected.
 */
export type ChannelConnectionLookup =
  | { kind: "none" }
  | { kind: "unreadable"; row: ChannelConnectionRow }
  | { kind: "ok"; connection: MetaConnection };

/** By the id Meta addresses it with: page id (messenger) / IG id (instagram). */
export async function lookupConnectionByExternalId(
  externalId: string,
): Promise<ChannelConnectionLookup> {
  const raw = (await prisma.channelConnection.findFirst({
    where: { externalId, active: true },
    select: { ...ROW_SELECT, accessToken: true },
  })) as (RawRow & { accessToken: string }) | null;
  if (!raw) return { kind: "none" };

  const { accessToken, ...rest } = raw;
  try {
    return {
      kind: "ok",
      connection: { ...toRow(rest, true), accessToken: decryptSecret(accessToken) },
    };
  } catch (err) {
    console.error(
      `[channels] connection ${raw.id} has an unreadable access token — reconnect the Page:`,
      err,
    );
    return { kind: "unreadable", row: toRow(rest, false) };
  }
}

/**
 * The old shape, for callers that genuinely cannot act on the difference —
 * "no usable connection" is all they can do anything about.
 */
export async function findConnectionByExternalId(
  externalId: string,
): Promise<MetaConnection | null> {
  const lookup = await lookupConnectionByExternalId(externalId);
  return lookup.kind === "ok" ? lookup.connection : null;
}

export async function getConnection(id: string): Promise<MetaConnection | null> {
  const raw = await prisma.channelConnection.findUnique({
    where: { id },
    select: { ...ROW_SELECT, accessToken: true },
  });
  return withToken(raw as (RawRow & { accessToken: string }) | null);
}

/**
 * "Last event received" on the Channels panel — the liveness signal.
 *
 * Monotonic: Meta redelivers, and a delivery can arrive out of order, so the
 * write is guarded to `max(existing, at)`. Letting a replay drag the timestamp
 * backwards would make a perfectly healthy connection look stale.
 */
export async function touchConnectionEvent(
  id: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.channelConnection.updateMany({
    where: { id, OR: [{ lastEventAt: null }, { lastEventAt: { lt: at } }] },
    data: { lastEventAt: at },
  });
}

/** Disconnect. Messages keep their history — the FK is SetNull. */
export async function deleteConnection(id: string): Promise<number> {
  const res = await prisma.channelConnection.deleteMany({ where: { id } });
  return res.count;
}

/** How long a connection may go without an event before we suggest a repair. */
export const RECONNECT_AFTER_DAYS = 30;

const DAY_MS = 86_400_000;

export type ConnectionHealth =
  | { level: "ok"; message: null }
  | { level: "quiet"; message: string }
  | { level: "unreadable"; message: string };

/**
 * How a connection is doing, from what we already store.
 *
 * A Meta connection rots quietly — an expired token, an unsubscribed Page, the
 * app removed in Business Settings — and nothing throws: messages simply stop
 * arriving, which is indistinguishable from a quiet week until someone asks
 * why nobody is messaging. `lastEventAt` is the only honest signal we hold
 * without calling Graph, and it is enough to say "check this".
 *
 * We deliberately do NOT call Graph's `/debug_token`: it takes both tokens as
 * QUERY parameters, and a page token must never travel in a URL — query
 * strings end up in access logs, proxies and error trackers.
 */
export function connectionHealth(
  row: Pick<
    ChannelConnectionRow,
    "tokenReadable" | "lastEventAt" | "connectedAt"
  >,
  now: Date = new Date(),
): ConnectionHealth {
  if (!row.tokenReadable) {
    return {
      level: "unreadable",
      message: "Reconnect required — the stored token can't be read.",
    };
  }
  // Silence is measured from whichever is LATER: the last event, or the
  // connection. A brand-new connection has not had time to be quiet in — and
  // neither has a repaired one, whose `connectedAt` moves forward on every
  // reconnect. Taking only `lastEventAt` when it exists would leave the nag
  // on screen straight after the owner had acted on it.
  const fromEvent =
    row.lastEventAt !== null && row.lastEventAt >= row.connectedAt;
  const since = fromEvent ? row.lastEventAt! : row.connectedAt;
  const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
  if (days < RECONNECT_AFTER_DAYS) return { level: "ok", message: null };
  return {
    level: "quiet",
    message: fromEvent
      ? `Reconnect recommended — nothing received for ${days} days.`
      : `Reconnect recommended — nothing received since it was connected ${days} days ago.`,
  };
}
