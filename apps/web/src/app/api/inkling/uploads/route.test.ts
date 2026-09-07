import { beforeEach, describe, expect, it, vi } from "vitest";

const createMoodboardAsset = vi.hoisted(() =>
  vi.fn(async (i: { bytes: Uint8Array; mime: string }) => ({
    id: "asset_1",
    mime: i.mime,
    size: i.bytes.length,
  })),
);
vi.mock("@bnb/core/services/moodboard-assets", () => ({
  createMoodboardAsset,
}));

const { POST } = await import("./route");

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
]);
let ip = 0;
function upload(file: File | null, pinnedIp?: string) {
  const fd = new FormData();
  if (file) fd.set("file", file);
  return POST(
    new Request("http://x/api/inkling/uploads", {
      method: "POST",
      body: fd,
      headers: { "x-forwarded-for": pinnedIp ?? `10.2.${++ip}.1` },
    }),
  );
}

// NB: block body — an implicit return of `mockClear()`'s chainable return
// value (the mock itself) makes Vitest treat this hook as returning a
// cleanup callback, which it then invokes again with no arguments after
// the test runs.
beforeEach(() => {
  createMoodboardAsset.mockClear();
});

describe("POST /api/inkling/uploads", () => {
  it("stores a sniffed png and returns the asset url", async () => {
    const res = await upload(new File([PNG], "a.png", { type: "image/png" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      assetId: "asset_1",
      url: "/api/inkling/assets/asset_1",
    });
    expect(createMoodboardAsset.mock.calls[0][0].mime).toBe("image/png");
  });
  it("400s without a file or with an empty one", async () => {
    expect((await upload(null)).status).toBe(400);
    expect(
      (await upload(new File([], "e.png", { type: "image/png" }))).status,
    ).toBe(400);
  });
  it("415s for svg / mismatched bytes", async () => {
    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    expect((await upload(svg)).status).toBe(415);
    const fake = new File(["<svg/>"], "x.png", { type: "image/png" });
    expect((await upload(fake)).status).toBe(415);
  });
  it("413s over 5MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    expect((await upload(big)).status).toBe(413);
  });
  it("413s from the content-length header alone, before parsing the body", async () => {
    const res = await POST(
      new Request("http://x/api/inkling/uploads", {
        method: "POST",
        body: new Uint8Array(0),
        headers: {
          "x-forwarded-for": `10.2.${++ip}.1`,
          "content-length": String(20 * 1024 * 1024),
        },
      }),
    );
    expect(res.status).toBe(413);
    expect(createMoodboardAsset).not.toHaveBeenCalled();
  });
  it("429s after 6 uploads from one IP", async () => {
    for (let i = 0; i < 6; i++)
      await upload(new File([PNG], "a.png", { type: "image/png" }), "8.8.8.8");
    expect(
      (await upload(new File([PNG], "a.png", { type: "image/png" }), "8.8.8.8"))
        .status,
    ).toBe(429);
  });
});
