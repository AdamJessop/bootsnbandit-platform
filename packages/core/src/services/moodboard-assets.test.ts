import { afterAll, describe, expect, it } from "vitest";
import {
  attachMoodboardAssets,
  createMoodboardAsset,
  getMoodboardAsset,
  purgeOrphanMoodboardAssets,
} from "./moodboard-assets";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

describe("moodboard assets (DB)", () => {
  const assetIds: string[] = [];
  const enquiryIds: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (assetIds.length)
        await db().moodboardAsset.deleteMany({
          where: { id: { in: assetIds } },
        });
      if (enquiryIds.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    }
    await closeTestDb();
  });

  it("stores and reads back bytes + mime", async () => {
    if (!(await dbReachable())) return;
    const created = await createMoodboardAsset({
      bytes: PNG,
      mime: "image/png",
    });
    assetIds.push(created.id);
    expect(created.size).toBe(PNG.length);
    const got = await getMoodboardAsset(created.id);
    expect(got?.mime).toBe("image/png");
    expect(Array.from(got!.bytes)).toEqual(Array.from(PNG));
    expect(await getMoodboardAsset("nope")).toBeNull();
  });

  it("attaches only unattached assets to an enquiry; purge skips attached", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Board ${uid()}`, source: "inkling" },
    });
    enquiryIds.push(enquiry.id);
    const a = await createMoodboardAsset({ bytes: PNG, mime: "image/png" });
    const b = await createMoodboardAsset({ bytes: PNG, mime: "image/png" });
    assetIds.push(a.id, b.id);
    expect(await attachMoodboardAssets(enquiry.id, [a.id])).toBe(1);
    // Backdate both so the purge window covers them.
    await db().moodboardAsset.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { createdAt: new Date(Date.now() - 48 * 3600_000) },
    });
    const purged = await purgeOrphanMoodboardAssets(
      new Date(Date.now() - 24 * 3600_000),
    );
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await getMoodboardAsset(a.id)).not.toBeNull();
    expect(await getMoodboardAsset(b.id)).toBeNull();
  });
});
