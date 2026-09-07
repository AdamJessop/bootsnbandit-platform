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

function toMeta(row: {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  bytes: Uint8Array | null;
}): AttachmentMeta {
  return {
    id: row.id,
    mime: row.mime,
    size: row.size,
    filename: row.filename,
    url: row.url,
    hasBytes: row.bytes !== null,
  };
}

export async function storeAttachment(
  input: StoreAttachmentInput,
): Promise<AttachmentMeta> {
  const size = input.bytes?.byteLength ?? 0;
  const inline = Boolean(input.bytes) && isInlineableAttachment(input.mime, size);
  const row = await prisma.attachment.create({
    data: {
      messageId: input.messageId ?? null,
      mime: input.mime,
      filename: input.filename ?? null,
      size,
      bytes: inline ? Uint8Array.from(input.bytes as Uint8Array) : null,
      url: input.url ?? null,
    },
    select: { id: true, mime: true, size: true, filename: true, url: true, bytes: true },
  });
  return toMeta({ ...row, bytes: row.bytes ? new Uint8Array(row.bytes) : null });
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
  return { ...toMeta({ ...row, bytes }), bytes };
}

/** Attachments for a batch of messages, grouped by message id (inbox render). */
export async function listAttachmentsFor(
  messageIds: string[],
): Promise<Map<string, AttachmentMeta[]>> {
  const map = new Map<string, AttachmentMeta[]>();
  if (messageIds.length === 0) return map;
  const rows = await prisma.attachment.findMany({
    where: { messageId: { in: messageIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mime: true,
      size: true,
      filename: true,
      url: true,
      bytes: true,
      messageId: true,
    },
  });
  for (const row of rows) {
    if (!row.messageId) continue;
    const list = map.get(row.messageId) ?? [];
    list.push(toMeta({ ...row, bytes: row.bytes ? new Uint8Array(row.bytes) : null }));
    map.set(row.messageId, list);
  }
  return map;
}
