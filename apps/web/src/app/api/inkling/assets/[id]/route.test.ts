import { describe, expect, it, vi } from "vitest";

const getMoodboardAsset = vi.hoisted(() => vi.fn());
vi.mock("@bnb/core/services/moodboard-assets", () => ({ getMoodboardAsset }));
const { GET } = await import("./route");

const call = (id: string) =>
  GET(new Request(`http://x/api/inkling/assets/${id}`), {
    params: Promise.resolve({ id }),
  });

describe("GET /api/inkling/assets/[id]", () => {
  it("streams the bytes with mime + immutable caching", async () => {
    getMoodboardAsset.mockResolvedValueOnce({
      id: "a1",
      mime: "image/png",
      size: 3,
      bytes: new Uint8Array([1, 2, 3]),
    });
    const res = await call("a1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it("404s for an unknown id", async () => {
    getMoodboardAsset.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
  });
});
