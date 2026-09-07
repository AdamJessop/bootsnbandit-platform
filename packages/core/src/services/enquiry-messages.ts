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
  type StoreAttachmentInput,
} from "./assets";

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
 * Which enquiries this staff user may see. Owners see all; artists see their
 * own plus every unassigned enquiry (any channel) so nothing sits unclaimed.
 * Mirrors `artistInboxWhere` in the admin inbox helpers — change both together.
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

async function createMessage(
  input: RecordMessageInput & {
    direction: MessageDirection;
    authorUserId?: string | null;
  },
): Promise<ThreadMessageRow> {
  const createdAt = input.at ?? new Date();

  // Webhook retries deliver the same provider id twice — return what we stored.
  if (input.externalId) {
    const existing = await prisma.enquiryMessage.findUnique({
      where: { externalId: input.externalId },
      select: MESSAGE_SELECT,
    });
    if (existing) {
      const map = await listAttachmentsFor([existing.id]);
      return toRow(existing, map.get(existing.id) ?? []);
    }
  }

  const raw = await prisma.enquiryMessage.create({
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

  const attachments: ThreadAttachment[] = [];
  for (const attachment of input.attachments ?? []) {
    attachments.push(await storeAttachment({ ...attachment, messageId: raw.id }));
  }
  return toRow(raw, attachments);
}

/**
 * A message from the customer. Bumps both activity timestamps and, when the
 * enquiry was awaiting us after a reply, flags it `customer_replied` so it
 * surfaces in its own tab. Closed/converted threads keep their status.
 */
export async function recordInbound(
  input: RecordMessageInput,
): Promise<ThreadMessageRow> {
  const message = await createMessage({ ...input, direction: "inbound" });
  const at = input.at ?? message.createdAt;
  await prisma.enquiry.updateMany({
    where: { id: input.enquiryId, status: "replied" },
    data: { status: "customer_replied" },
  });
  await prisma.enquiry.update({
    where: { id: input.enquiryId },
    data: { lastMessageAt: at, lastInboundAt: at },
  });
  return message;
}

/**
 * A message we sent. Bumps `lastMessageAt` only and never touches the status —
 * `replyToEnquiry` marks the enquiry `replied`, while the automatic
 * enquiry-ack must leave a brand-new enquiry looking new.
 */
export async function recordOutbound(
  input: RecordMessageInput & { authorUserId?: string | null },
): Promise<ThreadMessageRow> {
  const message = await createMessage({ ...input, direction: "outbound" });
  await prisma.enquiry.update({
    where: { id: input.enquiryId },
    data: { lastMessageAt: input.at ?? message.createdAt },
  });
  return message;
}

/** A staff-only note. Never sent, and not customer traffic — no timestamps. */
export async function recordNote(input: {
  enquiryId: string;
  authorUserId: string;
  bodyText: string;
  at?: Date;
}): Promise<ThreadMessageRow> {
  return createMessage({
    enquiryId: input.enquiryId,
    channel: "note",
    direction: "internal",
    authorUserId: input.authorUserId,
    bodyText: input.bodyText,
    at: input.at,
  });
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
