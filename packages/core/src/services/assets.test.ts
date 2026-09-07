import { afterAll, describe, expect, it } from "vitest";
import {
  getAttachment,
  isInlineableAttachment,
  listAttachmentsFor,
  MAX_INLINE_ATTACHMENT_BYTES,
  storeAttachment,
} from "./assets";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe("isInlineableAttachment", () => {
  it("accepts images within the cap and rejects everything else", () => {
    expect(isInlineableAttachment("image/png", 1024)).toBe(true);
    expect(isInlineableAttachment("image/jpeg", MAX_INLINE_ATTACHMENT_BYTES)).toBe(true);
    expect(isInlineableAttachment("image/png", MAX_INLINE_ATTACHMENT_BYTES + 1)).toBe(false);
    expect(isInlineableAttachment("application/pdf", 10)).toBe(false);
    expect(isInlineableAttachment("image/svg+xml", 10)).toBe(false);
  });
});

describe("attachments (DB)", () => {
  const db = () => testDb();
  const ids: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (ids.length) await db().attachment.deleteMany({ where: { id: { in: ids } } });
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
    }
    await closeTestDb();
  });

  it("stores image bytes inline and reads them back", async () => {
    if (!(await dbReachable())) return;
    const meta = await storeAttachment({
      mime: "image/png",
      filename: "ref.png",
      bytes: PNG,
    });
    ids.push(meta.id);
    expect(meta).toMatchObject({
      mime: "image/png",
      size: PNG.length,
      filename: "ref.png",
      url: null,
      hasBytes: true,
    });
    const got = await getAttachment(meta.id);
    expect(Array.from(got!.bytes!)).toEqual(Array.from(PNG));
    expect(await getAttachment("nope")).toBeNull();
  });

  it("keeps a link only for non-images and oversize files", async () => {
    if (!(await dbReachable())) return;
    const pdf = await storeAttachment({
      mime: "application/pdf",
      filename: "brief.pdf",
      bytes: PNG,
      url: "https://files.test/brief.pdf",
    });
    ids.push(pdf.id);
    expect(pdf.hasBytes).toBe(false);
    expect(pdf.url).toBe("https://files.test/brief.pdf");
    expect((await getAttachment(pdf.id))!.bytes).toBeNull();

    // Over the inline cap: the size is real, so the bytes are dropped and only
    // the source link survives. Allocated once, freed at the end of the case.
    const huge = await storeAttachment({
      mime: "image/png",
      filename: "huge.png",
      bytes: new Uint8Array(MAX_INLINE_ATTACHMENT_BYTES + 1),
      url: "https://files.test/huge.png",
    });
    ids.push(huge.id);
    expect(huge.hasBytes).toBe(false);
    expect(huge.size).toBe(MAX_INLINE_ATTACHMENT_BYTES + 1);
    expect(huge.url).toBe("https://files.test/huge.png");
  });

  it("stores a link-only attachment with no bytes at all", async () => {
    if (!(await dbReachable())) return;
    const link = await storeAttachment({
      mime: "application/zip",
      url: "https://files.test/pack.zip",
    });
    ids.push(link.id);
    expect(link.size).toBe(0);
    expect(link.hasBytes).toBe(false);
  });

  it("groups attachments by message id", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Att ${uid()}` },
    });
    enquiries.push(enquiry.id);
    const message = await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        direction: "inbound",
        channel: "email",
        bodyText: "see attached",
      },
    });
    const a = await storeAttachment({ mime: "image/png", bytes: PNG, messageId: message.id });
    const b = await storeAttachment({ mime: "image/png", bytes: PNG, messageId: message.id });
    ids.push(a.id, b.id);
    const map = await listAttachmentsFor([message.id, "missing"]);
    expect(map.get(message.id)?.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    expect(map.get("missing")).toBeUndefined();
    expect(await listAttachmentsFor([])).toEqual(new Map());
  });
});
