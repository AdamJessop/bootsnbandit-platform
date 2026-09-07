import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@bnb/core/db";

/**
 * Generalised message-attachment store, following MoodboardAsset's reasoning:
 * container disks are ephemeral and the apps are separate services, so small
 * images live in Postgres as bytea. Anything non-image or over the cap keeps
 * a source link instead — the inbox renders it as a download link rather than
 * pulling megabytes through the database.
 *
 * SVG is never inlined: it is XML and can carry script, and these bytes are
 * served back to signed-in staff.
 */

/** Either the top-level client or an in-flight `$transaction` callback client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const INLINE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function isInlineableAttachment(mime: string, size: number): boolean {
  return INLINE_MIMES.has(mime) && size <= MAX_INLINE_ATTACHMENT_BYTES;
}

export interface StoreAttachmentInput {
  mime: string;
  filename?: string | null;
  bytes?: Uint8Array | null;
  url?: string | null;
  messageId?: string | null;
}

export interface AttachmentMeta {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  hasBytes: boolean;
}

/**
 * `hasBytes` is metadata, never the bytes themselves: nothing on a render path
 * may SELECT the bytea column. Each caller supplies the flag from something it
 * already knows — what it just wrote, or a `bytes IS NOT NULL` computed in SQL.
 */
function toMeta(row: {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  hasBytes: boolean;
}): AttachmentMeta {
  return {
    id: row.id,
    mime: row.mime,
    size: row.size,
    filename: row.filename,
    url: row.url,
    hasBytes: row.hasBytes,
  };
}

export async function storeAttachment(
  input: StoreAttachmentInput,
  client: DbClient = prisma,
): Promise<AttachmentMeta> {
  const size = input.bytes?.byteLength ?? 0;
  const inline = Boolean(input.bytes) && isInlineableAttachment(input.mime, size);
  const row = await client.attachment.create({
    data: {
      messageId: input.messageId ?? null,
      mime: input.mime,
      filename: input.filename ?? null,
      size,
      bytes: inline ? Uint8Array.from(input.bytes as Uint8Array) : null,
      url: input.url ?? null,
    },
    // No `bytes` in the select: we just wrote them, so `inline` already says
    // whether the row has any — reading them back would double the traffic.
    select: { id: true, mime: true, size: true, filename: true, url: true },
  });
  return toMeta({ ...row, hasBytes: inline });
}

export async function getAttachment(
  id: string,
): Promise<(AttachmentMeta & { bytes: Uint8Array | null }) | null> {
  const row = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, mime: true, size: true, filename: true, url: true, bytes: true },
  });
  if (!row) return null;
  const bytes = row.bytes ? new Uint8Array(row.bytes) : null;
  return { ...toMeta({ ...row, hasBytes: bytes !== null }), bytes };
}

interface AttachmentListRow {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  messageId: string | null;
  hasBytes: boolean;
}

/**
 * Attachments for a batch of messages, grouped by message id (inbox render).
 *
 * Raw SQL on purpose: the inbox needs to know whether a row HAS bytes, not
 * what they are, and Prisma has no way to select a computed column — a
 * `select: { bytes: true }` would drag every inline image (up to 8 MB each)
 * through the database and into the render for a single boolean. Postgres
 * computes `bytes IS NOT NULL` instead and sends one bit.
 */
export async function listAttachmentsFor(
  messageIds: string[],
  client: DbClient = prisma,
): Promise<Map<string, AttachmentMeta[]>> {
  const map = new Map<string, AttachmentMeta[]>();
  if (messageIds.length === 0) return map;
  const rows = await client.$queryRaw<AttachmentListRow[]>`
    SELECT "id", "mime", "size", "filename", "url", "messageId",
           "bytes" IS NOT NULL AS "hasBytes"
    FROM "Attachment"
    WHERE "messageId" IN (${Prisma.join(messageIds)})
    ORDER BY "createdAt" ASC
  `;
  for (const row of rows) {
    if (!row.messageId) continue;
    const list = map.get(row.messageId) ?? [];
    list.push(toMeta(row));
    map.set(row.messageId, list);
  }
  return map;
}
