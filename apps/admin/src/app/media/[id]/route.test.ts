import { describe, expect, it, vi } from "vitest";

const getMediaAsset = vi.hoisted(() => vi.fn());
vi.mock("@bnb/core/services/media-assets", () => ({ getMediaAsset }));
const { GET, runtime } = await import("./route");

const call = (id: string) =>
  GET(new Request(`http://x/media/${id}`), {
    params: Promise.resolve({ id }),
  });

describe("GET /media/[id] (admin)", () => {
  it("serves the stored image on the Node runtime", async () => {
    expect(runtime).toBe("nodejs");
    getMediaAsset.mockResolvedValueOnce({
      id: "m1",
      mime: "image/png",
      size: 2,
      bytes: new Uint8Array([0x89, 0x50]),
    });
    const res = await call("m1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });
  it("404s for an unknown id", async () => {
    getMediaAsset.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
  });
});
