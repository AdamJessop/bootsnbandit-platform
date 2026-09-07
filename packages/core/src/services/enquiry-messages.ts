import type {
  MessageChannelKind,
  MessageDirection,
  MessageStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@bnb/core/db";
import {
  listAttachmentsFor,
  storeAttachment,
  type AttachmentMeta,
  type DbClient,
  type StoreAttachmentInput,
} from "./assets";
import { isUniqueViolation } from "./contact-identity";

/**
 * The enquiry thread: every inbound customer message, every outbound staff
 * reply and every internal note, in one chronological log per enquiry, plus
 * the per-user read markers that drive the unread badge.
 *
 * Status side effects live here so every channel behaves identically:
 * an inbound message on a `replied` enquiry flips it to `customer_replied`,
 * a `new` one stays `new`, and `converted`/`closed` are never reopened.
 */

export interface InboxViewer {
  userId: string;
  role: "OWNER" | "ARTIST";
  artistId: string | null;
}

/**
 * The canonical visibility rule: owners see everything, artists see their own
 * enquiries plus every unassigned one (any channel) so nothing sits unclaimed.
 * The admin inbox's `artistInboxWhere` helper is being aligned to this rule in
 * Task 10 — change both together until then.
 */
export function visibleEnquiryWhere(viewer: InboxViewer): Prisma.EnquiryWhereInput {
  if (viewer.role === "OWNER") return {};
  if (!viewer.artistId) return { id: "__none__" };
  return {
    OR: [{ preferredArtistId: viewer.artistId }, { preferredArtistId: null }],
  };
}

export type ThreadAttachment = AttachmentMeta;

export interface ThreadMessageRow {
  id: string;
  enquiryId: string;
  direction: MessageDirection;
  channel: MessageChannelKind;
  authorUserId: string | null;
  authorName: string | null;
  fromName: string | null;
  fromAddress: string | null;
  subject: string | null;
  bodyText: string;
  deliveryStatus: MessageStatus;
  createdAt: Date;
  attachments: ThreadAttachment[];
}

const MESSAGE_SELECT = {
  id: true,
  enquiryId: true,
  direction: true,
  channel: true,
  authorUserId: true,
  fromName: true,
  fromAddress: true,
  subject: true,
  bodyText: true,
  deliveryStatus: true,
  createdAt: true,
  authorUser: { select: { displayName: true } },
} as const;

type RawMessage = Prisma.EnquiryMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

function toRow(raw: RawMessage, attachments: ThreadAttachment[]): ThreadMessageRow {
  return {
    id: raw.id,
    enquiryId: raw.enquiryId,
    direction: raw.direction,
    channel: raw.channel,
    authorUserId: raw.authorUserId,
    authorName: raw.authorUser?.displayName ?? null,
    fromName: raw.fromName,
    fromAddress: raw.fromAddress,
    subject: raw.subject,
    bodyText: raw.bodyText,
    deliveryStatus: raw.deliveryStatus,
    createdAt: raw.createdAt,
    attachments,
  };
}

export interface RecordMessageInput {
  enquiryId: string;
  customerId?: string | null;
  channel: MessageChannelKind;
  bodyText: string;
  bodyHtml?: string | null;
  subject?: string | null;
  fromName?: string | null;
  fromAddress?: string | null;
  externalId?: string | null;
  deliveryStatus?: MessageStatus;
  attachments?: StoreAttachmentInput[];
  at?: Date;
}

interface CreateMessageResult {
  row: ThreadMessageRow;
  /**
   * True when this call found (or raced into) a pre-existing row for the
   * given `externalId` rather than inserting a new one. Callers must skip
   * every side effect (status flip, timestamp bump) in that case — a replayed
   * webhook delivery is not new customer traffic.
   */
  isDuplicate: boolean;
}

async function readExisting(
  client: DbClient,
  externalId: string,
): Promise<CreateMessageResult | null> {
  const existing = await client.enquiryMessage.findUnique({
    where: { externalId },
    select: MESSAGE_SELECT,
  });
  if (!existing) return null;
  const map = await listAttachmentsFor([existing.id], client);
  return { row: toRow(existing, map.get(existing.id) ?? []), isDuplicate: true };
}

/**
 * Fast-path idempotency check, run against the plain client *before* opening
 * a write transaction: a replayed `externalId` we already stored should never
 * pay for (or risk) a transaction at all. Runs outside any transaction the
 * caller may open next, which is fine — a true race is still caught by the
 * P2002 handler inside `createMessage`.
 */
async function findByExternalId(
  externalId: string | null | undefined,
): Promise<CreateMessageResult | null> {
  if (!externalId) return null;
  return readExisting(prisma, externalId);
}

async function createMessage(
  tx: DbClient,
  input: RecordMessageInput & {
    direction: MessageDirection;
    authorUserId?: string | null;
  },
): Promise<CreateMessageResult> {
  const createdAt = input.at ?? new Date();

  let raw: RawMessage;
  try {
    raw = await tx.enquiryMessage.create({
      data: {
        enquiryId: input.enquiryId,
        customerId: input.customerId ?? null,
        direction: input.direction,
        channel: input.channel,
        authorUserId: input.authorUserId ?? null,
        fromName: input.fromName ?? null,
        fromAddress: input.fromAddress ?? null,
        subject: input.subject ?? null,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml ?? null,
        externalId: input.externalId ?? null,
        deliveryStatus: input.deliveryStatus ?? "logged",
        createdAt,
      },
      select: MESSAGE_SELECT,
    });
  } catch (err) {
    // Two concurrent deliveries of the same provider id can both pass the
    // caller's fast-path externalId check (neither sees the other's row yet);
    // one create wins and the other hits P2002 here. A Postgres transaction
    // is aborted the instant a statement inside it errors — no further query
    // on `tx` would even run — so the recovery re-read deliberately goes
    // through the plain client on its own connection, exactly like the
    // fast-path check above. Treat it as the idempotent-duplicate case: the
    // loser must not double-apply status/timestamp side effects either.
    if (input.externalId && isUniqueViolation(err)) {
      const winner = await readExisting(prisma, input.externalId);
      if (winner) return winner;
    }
    throw err;
  }

  const attachments: ThreadAttachment[] = [];
  for (const attachment of input.attachments ?? []) {
    attachments.push(
      await storeAttachment({ ...attachment, messageId: raw.id }, tx),
    );
  }
  return { row: toRow(raw, attachments), isDuplicate: false };
}

/**
 * A message from the customer. Bumps both activity timestamps and, when the
 * enquiry was awaiting us after a reply, flags it `customer_replied` so it
 * surfaces in its own tab. Closed/converted threads keep their status.
 *
 * The insert, the status flip and the timestamp bump all run inside one
 * transaction so a crash between steps can never leave a stored message
 * without its side effects. A replayed `externalId` short-circuits before any
 * of that runs — the message already carries its original side effects.
 */
export async function recordInbound(
  input: RecordMessageInput,
): Promise<ThreadMessageRow> {
  const duplicate = await findByExternalId(input.externalId);
  if (duplicate) return duplicate.row;

  return prisma.$transaction(async (tx) => {
    const { row, isDuplicate } = await createMessage(tx, {
      ...input,
      direction: "inbound",
    });
    if (isDuplicate) return row;

    const at = input.at ?? row.createdAt;
    await tx.enquiry.updateMany({
      where: { id: input.enquiryId, status: "replied" },
      data: { status: "customer_replied" },
    });
    await tx.enquiry.update({
      where: { id: input.enquiryId },
      data: { lastMessageAt: at, lastInboundAt: at },
    });
    return row;
  });
}

/**
 * A message we sent. Bumps `lastMessageAt` only and never touches the status —
 * `replyToEnquiry` marks the enquiry `replied`, while the automatic
 * enquiry-ack must leave a brand-new enquiry looking new. Insert and bump run
 * in one transaction; a replayed `externalId` skips the bump entirely.
 */
export async function recordOutbound(
  input: RecordMessageInput & { authorUserId?: string | null },
): Promise<ThreadMessageRow> {
  const duplicate = await findByExternalId(input.externalId);
  if (duplicate) return duplicate.row;

  return prisma.$transaction(async (tx) => {
    const { row, isDuplicate } = await createMessage(tx, {
      ...input,
      direction: "outbound",
    });
    if (isDuplicate) return row;

    await tx.enquiry.update({
      where: { id: input.enquiryId },
      data: { lastMessageAt: input.at ?? row.createdAt },
    });
    return row;
  });
}

/** A staff-only note. Never sent, and not customer traffic — no timestamps. */
export async function recordNote(input: {
  enquiryId: string;
  authorUserId: string;
  bodyText: string;
  at?: Date;
}): Promise<ThreadMessageRow> {
  const { row } = await createMessage(prisma, {
    enquiryId: input.enquiryId,
    channel: "note",
    direction: "internal",
    authorUserId: input.authorUserId,
    bodyText: input.bodyText,
    at: input.at,
  });
  return row;
}

export async function listThread(enquiryId: string): Promise<ThreadMessageRow[]> {
  return (await listThreadsFor([enquiryId])).get(enquiryId) ?? [];
}

/** Threads for a batch of enquiries — one query per table, for the inbox list. */
export async function listThreadsFor(
  enquiryIds: string[],
): Promise<Map<string, ThreadMessageRow[]>> {
  const map = new Map<string, ThreadMessageRow[]>();
  if (enquiryIds.length === 0) return map;
  const raws = await prisma.enquiryMessage.findMany({
    where: { enquiryId: { in: enquiryIds } },
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: MESSAGE_SELECT,
  });
  const attachments = await listAttachmentsFor(raws.map((r) => r.id));
  for (const raw of raws) {
    const list = map.get(raw.enquiryId) ?? [];
    list.push(toRow(raw, attachments.get(raw.id) ?? []));
    map.set(raw.enquiryId, list);
  }
  return map;
}

/** Mark the thread read for this user (idempotent; only ever moves forward). */
export async function markRead(
  enquiryId: string,
  userId: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.enquiryRead.upsert({
    where: { enquiryId_userId: { enquiryId, userId } },
    create: { enquiryId, userId, readAt: at },
    update: { readAt: at },
  });
}

export interface UnreadCounts {
  total: number;
  enquiryIds: string[];
}

/**
 * Enquiries with customer traffic this user has not caught up on: visible to
 * them, still open, with a `lastInboundAt` newer than their read marker (or no
 * marker at all). The comparison is done in JS because Prisma cannot compare a
 * relation's field against the parent row's field.
 */
export async function unreadCountsFor(viewer: InboxViewer): Promise<UnreadCounts> {
  const rows = await prisma.enquiry.findMany({
    where: {
      AND: [
        visibleEnquiryWhere(viewer),
        { lastInboundAt: { not: null } },
        { status: { in: ["new", "replied", "customer_replied"] } },
      ],
    },
    orderBy: { lastInboundAt: "desc" },
    take: 500,
    select: {
      id: true,
      lastInboundAt: true,
      reads: { where: { userId: viewer.userId }, select: { readAt: true } },
    },
  });

  const enquiryIds = rows
    .filter((row) => {
      const inbound = row.lastInboundAt?.getTime();
      if (inbound === undefined) return false;
      const readAt = row.reads[0]?.readAt.getTime();
      return readAt === undefined || readAt < inbound;
    })
    .map((row) => row.id);

  return { total: enquiryIds.length, enquiryIds };
}
