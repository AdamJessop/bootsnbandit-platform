import { prisma } from "@bnb/core/db";

/**
 * CMS image uploads (gallery / flash / styles / artist headshots) live in
 * Postgres (bytea) rather than on disk: web + admin are separate containers,
 * container disks are ephemeral, and Next only serves `public/` files that
 * existed at build time. Served publicly by both apps at `/media/[id]`.
 */

export interface MediaAssetMeta {
  id: string;
  mime: string;
  size: number;
}

/** The public, origin-relative URL both apps serve a stored asset at. */
export function mediaUrl(id: string): string {
  return `/media/${id}`;
}

export async function createMediaAsset(input: {
  bytes: Uint8Array;
  mime: string;
}): Promise<MediaAssetMeta> {
  const row = await prisma.mediaAsset.create({
    data: {
      bytes: Uint8Array.from(input.bytes),
      mime: input.mime,
      size: input.bytes.byteLength,
    }, // Uint8Array.from() returns Uint8Array<ArrayBuffer> for Prisma Bytes typing
    select: { id: true, mime: true, size: true },
  });
  return row;
}

export async function getMediaAsset(
  id: string,
): Promise<(MediaAssetMeta & { bytes: Uint8Array }) | null> {
  const row = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { id: true, mime: true, size: true, bytes: true },
  });
  return row ? { ...row, bytes: new Uint8Array(row.bytes) } : null;
}
