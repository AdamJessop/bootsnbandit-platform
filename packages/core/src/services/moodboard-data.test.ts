import { describe, expect, it } from "vitest";
import {
  assetUrl,
  finaliseMoodboardData,
  parseMoodboardData,
  type MoodboardData,
} from "./moodboard-data";

const base: MoodboardData = {
  version: 1,
  styles: ["Fine-line"],
  colour: "bw",
  description: "peony on the forearm",
  query: "peony on the forearm fine-line black and grey tattoo",
  notes: null,
  items: [
    { kind: "web", url: "https://img.example/a.jpg", thumbUrl: "https://img.example/t.jpg", sourceUrl: "https://page.example/a", title: "Peony", assetId: null, galleryItemId: null },
    { kind: "studio", url: "/uploads/gallery/snake.jpg", thumbUrl: null, sourceUrl: "/gallery", title: "Snake", assetId: null, galleryItemId: "g1" },
    { kind: "upload", url: "blob:whatever", thumbUrl: null, sourceUrl: null, title: null, assetId: "asset1", galleryItemId: null },
    { kind: "upload", url: "", thumbUrl: null, sourceUrl: null, title: null, assetId: null, galleryItemId: null },
  ],
};

describe("parseMoodboardData", () => {
  it("returns null for null / garbage / wrong version", () => {
    expect(parseMoodboardData(null)).toBeNull();
    expect(parseMoodboardData("x")).toBeNull();
    expect(parseMoodboardData({ version: 2, items: [] })).toBeNull();
  });
  it("fills defaults for a minimal valid object", () => {
    const d = parseMoodboardData({ version: 1, items: [{ kind: "link", url: "https://x.test/a.png" }] });
    expect(d).not.toBeNull();
    expect(d!.styles).toEqual([]);
    expect(d!.items[0].thumbUrl).toBeNull();
  });
  it("rejects more than 12 items", () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ kind: "link", url: `https://x.test/${i}.png` }));
    expect(parseMoodboardData({ version: 1, items })).toBeNull();
  });
});

describe("finaliseMoodboardData", () => {
  const origin = "https://bootsnbandit.example";
  it("rewrites upload urls, absolutises relative urls, drops uploads without an asset", () => {
    const out = finaliseMoodboardData(base, origin);
    expect(out.data.items).toHaveLength(3);
    expect(out.data.items[1].url).toBe(`${origin}/uploads/gallery/snake.jpg`);
    expect(out.data.items[1].sourceUrl).toBe(`${origin}/gallery`);
    expect(out.data.items[2].url).toBe(assetUrl(origin, "asset1"));
    expect(out.urls).toEqual(out.data.items.map((i) => i.url));
    expect(out.assetIds).toEqual(["asset1"]);
  });
  it("strips a trailing slash from the origin", () => {
    expect(assetUrl("https://x.test/", "a")).toBe("https://x.test/api/inkling/assets/a");
  });
});
