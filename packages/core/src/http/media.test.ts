import { describe, expect, it, vi } from "vitest";

const getMediaAsset = vi.hoisted(() => vi.fn());
vi.mock("@bnb/core/services/media-assets", () => ({ getMediaAsset }));
const { serveMediaAsset } = await import("./media");

const call = (id: string) =>
  serveMediaAsset(new Request(`http://x/media/${id}`), {
    params: Promise.resolve({ id }),
  });

describe("GET /media/[id] (shared handler)", () => {
  it("streams the bytes with the stored mime, nosniff + immutable caching", async () => {
    getMediaAsset.mockResolvedValueOnce({
      id: "m1",
      mime: "image/webp",
      size: 3,
      bytes: new Uint8Array([1, 2, 3]),
    });
    const res = await call("m1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("content-length")).toBe("3");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it("404s for an unknown id", async () => {
    getMediaAsset.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
  });
  it("500s without leaking the error when the lookup throws", async () => {
    getMediaAsset.mockRejectedValueOnce(new Error("db down"));
    const res = await call("m1");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("db down");
  });
});
