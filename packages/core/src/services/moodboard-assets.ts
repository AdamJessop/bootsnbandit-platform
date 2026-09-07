import { prisma } from "@bnb/core/db";

/**
 * Inkling mood-board uploads live in Postgres (bytea) rather than on disk:
 * web + admin are separate containers and container disks are ephemeral.
 * Boards are small (≤12 images, client-downscaled) so this stays cheap.
 */

export interface MoodboardAssetMeta {
  id: string;
  mime: string;
  size: number;
}

export async function createMoodboardAsset(input: {
  bytes: Uint8Array;
  mime: string;
}): Promise<MoodboardAssetMeta> {
  const row = await prisma.moodboardAsset.create({
    data: { bytes: Uint8Array.from(input.bytes), mime: input.mime, size: input.bytes.byteLength }, // Uint8Array.from() returns Uint8Array<ArrayBuffer> for Prisma Bytes typing
    select: { id: true, mime: true, size: true },
  });
  return row;
}

export async function getMoodboardAsset(
  id: string,
): Promise<(MoodboardAssetMeta & { bytes: Uint8Array }) | null> {
  const row = await prisma.moodboardAsset.findUnique({
    where: { id },
    select: { id: true, mime: true, size: true, bytes: true },
  });
  return row ? { ...row, bytes: new Uint8Array(row.bytes) } : null;
}

/** Link uploaded assets to the enquiry they were sent with (only unattached ones). */
export async function attachMoodboardAssets(
  enquiryId: string,
  assetIds: string[],
): Promise<number> {
  if (assetIds.length === 0) return 0;
  const res = await prisma.moodboardAsset.updateMany({
    where: { id: { in: assetIds }, enquiryId: null },
    data: { enquiryId },
  });
  return res.count;
}

/** Delete uploads that were never sent with an enquiry and are older than `olderThan`. */
export async function purgeOrphanMoodboardAssets(olderThan: Date): Promise<number> {
  const res = await prisma.moodboardAsset.deleteMany({
    where: { enquiryId: null, createdAt: { lt: olderThan } },
  });
  return res.count;
}
