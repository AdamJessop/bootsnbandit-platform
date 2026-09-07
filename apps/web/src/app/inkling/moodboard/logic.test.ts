import { describe, expect, it } from "vitest";
import {
  BOARD_STEPS,
  budgetToPence,
  buildBoardEnquiryPayload,
  buildSearchRequest,
  canAdvance,
  emptyBuilder,
  linkToItem,
  parsePastedUrl,
  removeItem,
  shouldRunSearch,
  studioResultToItem,
  toggleItem,
  uploadToItem,
  webResultToItem,
  type BoardItem,
  type BuilderState,
} from "./logic";

const web = webResultToItem({
  url: "https://i.test/a.jpg",
  thumbUrl: "https://t.test/a.jpg",
  sourceUrl: "https://p.test/a",
  title: "Peony",
  width: 1,
  height: 1,
});
const studio = studioResultToItem({
  galleryItemId: "g1",
  url: "/uploads/g.jpg",
  title: "Snake",
  style: "Fine-line",
  artistName: "Sarah",
  sourceUrl: "/gallery",
});

function filled(over: Partial<BuilderState> = {}): BuilderState {
  return {
    ...emptyBuilder(),
    styles: ["Fine-line"],
    description: "peony forearm",
    items: [web],
    name: "Amy",
    email: "amy@example.com",
    ...over,
  };
}

describe("board items", () => {
  it("maps results to items with stable keys", () => {
    expect(web).toMatchObject({
      kind: "web",
      key: "https://i.test/a.jpg",
      assetId: null,
    });
    expect(studio).toMatchObject({
      kind: "studio",
      key: "studio:g1",
      galleryItemId: "g1",
      title: "Snake · Sarah",
    });
    expect(
      uploadToItem({ assetId: "a1", url: "/api/inkling/assets/a1" }),
    ).toMatchObject({ kind: "upload", key: "asset:a1", assetId: "a1" });
    expect(linkToItem("https://x.test/p.png")).toMatchObject({
      kind: "link",
      key: "https://x.test/p.png",
      url: "https://x.test/p.png",
    });
  });
  it("toggles on/off, dedupes, and caps at 12", () => {
    const on = toggleItem([], web);
    expect(on).toMatchObject({ ok: true, added: true });
    const off = toggleItem(on.ok ? on.items : [], web);
    expect(off).toMatchObject({ ok: true, added: false, items: [] });
    const many: BoardItem[] = Array.from({ length: 12 }, (_, i) =>
      linkToItem(`https://x.test/${i}.png`),
    );
    const full = toggleItem(many, studio);
    expect(full.ok).toBe(false);
    expect(removeItem(many, "https://x.test/3.png")).toHaveLength(11);
  });
  it("parses pasted urls", () => {
    expect(parsePastedUrl(" https://x.test/a.png ")).toBe(
      "https://x.test/a.png",
    );
    expect(parsePastedUrl("ftp://x")).toBeNull();
    expect(parsePastedUrl("just words")).toBeNull();
  });
});

describe("step gating", () => {
  it("has the four steps", () =>
    expect(BOARD_STEPS).toEqual(["Brief", "Inspiration", "Details", "Send"]));
  it("Brief needs a style or a 3+ char description", () => {
    expect(canAdvance("Brief", emptyBuilder())).toBe(false);
    expect(
      canAdvance("Brief", { ...emptyBuilder(), styles: ["Realism"] }),
    ).toBe(true);
    expect(canAdvance("Brief", { ...emptyBuilder(), description: "ab" })).toBe(
      false,
    );
    expect(canAdvance("Brief", { ...emptyBuilder(), description: "owl" })).toBe(
      true,
    );
  });
  it("Inspiration needs at least one item; Details always; Send needs name + contact", () => {
    expect(canAdvance("Inspiration", filled({ items: [] }))).toBe(false);
    expect(canAdvance("Inspiration", filled())).toBe(true);
    expect(canAdvance("Details", filled())).toBe(true);
    expect(canAdvance("Send", filled({ email: "", phone: "" }))).toBe(false);
    expect(
      canAdvance("Send", filled({ email: "", phone: "07123 456789" })),
    ).toBe(true);
    expect(canAdvance("Send", filled({ email: "not-an-email" }))).toBe(false);
  });
});

describe("requests + payload", () => {
  it("builds the search request", () => {
    expect(buildSearchRequest(filled({ colour: "bw" }), 11)).toEqual({
      styles: ["Fine-line"],
      colour: "bw",
      description: "peony forearm",
      start: 11,
    });
  });
  it("parses budgets", () => {
    expect(budgetToPence("150")).toBe(15000);
    expect(budgetToPence("£1,200.50")).toBe(120050);
    expect(budgetToPence("")).toBeNull();
    expect(budgetToPence("abc")).toBeNull();
  });
  it("builds the enquiry payload", () => {
    const p = buildBoardEnquiryPayload(
      filled({
        colour: "bw",
        query: "peony forearm fine-line black and grey tattoo",
        items: [web, studio],
        placement: "Forearm",
        size: "Medium",
        budget: "150",
        artistId: "art1",
        notes: "Would love it wrapping.",
        phone: " ",
      }),
    );
    expect(p).toMatchObject({
      contactName: "Amy",
      contactEmail: "amy@example.com",
      contactPhone: null,
      preferredArtistId: "art1",
      style: "Fine-line",
      placement: "Forearm",
      size: "Medium",
      budgetPence: 15000,
      source: "inkling",
      moodboard: ["https://i.test/a.jpg", "/uploads/g.jpg"],
    });
    expect(p.description).toBe("peony forearm\n\nWould love it wrapping.");
    expect(p.moodboardData.items[1]).not.toHaveProperty("key");
    expect(p.moodboardData).toMatchObject({
      version: 1,
      styles: ["Fine-line"],
      colour: "bw",
      notes: "Would love it wrapping.",
    });
  });
});

describe("shouldRunSearch", () => {
  it("runs when the brief key changed, regardless of status", () => {
    expect(shouldRunSearch(null, "a", "idle")).toBe(true);
    expect(shouldRunSearch("a", "b", "done")).toBe(true);
    expect(shouldRunSearch("a", "b", "loading")).toBe(true);
    expect(shouldRunSearch("a", "b", "error")).toBe(true);
  });
  it("is a no-op when the key matches and a run is done or in flight", () => {
    expect(shouldRunSearch("a", "a", "done")).toBe(false);
    expect(shouldRunSearch("a", "a", "loading")).toBe(false);
  });
  it("still runs when the key matches but the last run errored or hasn't started", () => {
    expect(shouldRunSearch("a", "a", "error")).toBe(true);
    expect(shouldRunSearch("a", "a", "idle")).toBe(true);
  });
});
