import { afterAll, describe, expect, it } from "vitest";
import { createMediaAsset, getMediaAsset, mediaUrl } from "./media-assets";
import { closeTestDb, dbReachable, testDb } from "./testdb";

const db = () => testDb();
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

describe("mediaUrl", () => {
  it("is the origin-relative /media/[id] path both apps serve", () => {
    expect(mediaUrl("abc123")).toBe("/media/abc123");
  });
});

describe("media assets (DB)", () => {
  const assetIds: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (assetIds.length)
        await db().mediaAsset.deleteMany({
          where: { id: { in: assetIds } },
        });
    }
    await closeTestDb();
  });

  it("stores and reads back bytes + mime", async () => {
    if (!(await dbReachable())) return;
    const created = await createMediaAsset({ bytes: PNG, mime: "image/png" });
    assetIds.push(created.id);
    expect(created.size).toBe(PNG.length);
    const got = await getMediaAsset(created.id);
    expect(got?.mime).toBe("image/png");
    expect(Array.from(got!.bytes)).toEqual(Array.from(PNG));
    expect(await getMediaAsset("nope")).toBeNull();
  });
});
