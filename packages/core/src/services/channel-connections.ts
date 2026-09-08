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

function toRow(raw: RawRow): ChannelConnectionRow {
  return { ...raw, channel: raw.channel as MetaChannel };
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
    update: shared,
    select: ROW_SELECT,
  });
  return toRow(row as RawRow);
}

/** Everything the Channels panel lists. Never selects the token column. */
export async function listChannelConnections(): Promise<ChannelConnectionRow[]> {
  const rows = await prisma.channelConnection.findMany({
    orderBy: [{ connectedAt: "desc" }, { id: "desc" }],
    select: ROW_SELECT,
  });
  return rows.map((row) => toRow(row as RawRow));
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
    return { ...toRow(rest), accessToken: decryptSecret(accessToken) };
  } catch (err) {
    console.error(
      `[channels] connection ${raw.id} has an unreadable access token — reconnect the Page:`,
      err,
    );
    return null;
  }
}

/** By the id Meta addresses it with: page id (messenger) / IG id (instagram). */
export async function findConnectionByExternalId(
  externalId: string,
): Promise<MetaConnection | null> {
  const raw = await prisma.channelConnection.findFirst({
    where: { externalId, active: true },
    select: { ...ROW_SELECT, accessToken: true },
  });
  return withToken(raw as (RawRow & { accessToken: string }) | null);
}

export async function getConnection(id: string): Promise<MetaConnection | null> {
  const raw = await prisma.channelConnection.findUnique({
    where: { id },
    select: { ...ROW_SELECT, accessToken: true },
  });
  return withToken(raw as (RawRow & { accessToken: string }) | null);
}

/** "Last event received" on the Channels panel — the liveness signal. */
export async function touchConnectionEvent(
  id: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.channelConnection.updateMany({
    where: { id },
    data: { lastEventAt: at },
  });
}

/** Disconnect. Messages keep their history — the FK is SetNull. */
export async function deleteConnection(id: string): Promise<number> {
  const res = await prisma.channelConnection.deleteMany({ where: { id } });
  return res.count;
}
