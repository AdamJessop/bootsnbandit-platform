import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ siteSettings: { findFirst: vi.fn() } }));
const createEnquiry = vi.hoisted(() => vi.fn(async (input: Record<string, unknown>) => ({ id: "e1", ...input })));
vi.mock("@bnb/core/db", () => ({ prisma }));
vi.mock("@bnb/core/services/enquiries", () => ({ createEnquiry }));
const { POST } = await import("./route");

let ip = 0;
const post = (body: unknown) =>
  POST(new Request("http://web.test/api/enquiries", {
    method: "POST", headers: { "x-forwarded-for": `10.3.${++ip}.1` }, body: JSON.stringify(body),
  }));

beforeEach(() => {
  prisma.siteSettings.findFirst.mockResolvedValue({ enquiriesOpen: true });
  createEnquiry.mockClear();
  delete process.env.APP_ORIGIN;
});

describe("POST /api/enquiries — mood board", () => {
  it("finalises moodboardData: asset urls, absolute urls, moodboard[] + assetIds", async () => {
    process.env.APP_ORIGIN = "https://site.test";
    const res = await post({
      contactName: "Board", contactPhone: "07123456789", source: "inkling",
      moodboardData: {
        version: 1, styles: ["Fine-line"], description: "peony",
        items: [
          { kind: "upload", url: "/pending", assetId: "as1" },
          { kind: "studio", url: "/uploads/g.jpg", galleryItemId: "g1" },
          { kind: "web", url: "https://i.test/a.jpg", sourceUrl: "https://p.test/a" },
        ],
      },
    });
    expect(res.status).toBe(201);
    const input = createEnquiry.mock.calls[0][0] as Record<string, unknown>;
    expect(input.moodboard).toEqual([
      "https://site.test/api/inkling/assets/as1",
      "https://site.test/uploads/g.jpg",
      "https://i.test/a.jpg",
    ]);
    expect(input.assetIds).toEqual(["as1"]);
    expect((input.moodboardData as { items: unknown[] }).items).toHaveLength(3);
  });
  it("falls back to the request origin when APP_ORIGIN is unset", async () => {
    await post({ contactName: "B", contactPhone: "07123456789", moodboardData: { version: 1, items: [{ kind: "upload", url: "/pending", assetId: "as2" }] } });
    const input = createEnquiry.mock.calls[0][0] as { moodboard: string[] };
    expect(input.moodboard).toEqual(["http://web.test/api/inkling/assets/as2"]);
  });
  it("400s on an invalid board", async () => {
    expect((await post({ contactName: "B", contactPhone: "07123456789", moodboardData: { version: 3, items: [] } })).status).toBe(400);
  });
});
