import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../enquire/enquire.module.css", () => ({ default: {} }));
vi.mock("./moodboard.module.css", () => ({ default: {} }));

const { BriefStep } = await import("./BriefStep");
const { InspirationStep } = await import("./InspirationStep");
const { DetailsStep } = await import("./DetailsStep");
const { SendStep } = await import("./SendStep");
const { BoardSummary } = await import("./BoardSummary");
const { emptyBuilder, linkToItem } = await import("./logic");

const set = () => {};
const ARTISTS = [{ id: "a1", name: "Sarah Boots", role: "Co-owner", slug: "sarah", booksStatus: "open" as const }];
const idleSearch = {
  status: "idle" as const, error: null, query: null, studio: [], web: [], nextStart: null,
  providerConfigured: true, webError: false, run: async () => {}, more: async () => {},
};

describe("mood-board steps", () => {
  it("Brief renders style chips, colour options and the description", () => {
    const html = renderToStaticMarkup(<BriefStep state={emptyBuilder()} set={set} styleOptions={["Fine-line", "Realism"]} />);
    expect(html).toContain("Fine-line");
    expect(html).toContain("Black &amp; grey");
    expect(html).toContain("Describe");
  });
  it("Inspiration shows results, the board tray and the upload/paste zone", () => {
    const state = { ...emptyBuilder(), items: [linkToItem("https://x.test/a.png")] };
    const search = {
      ...idleSearch, status: "done" as const,
      studio: [{ galleryItemId: "g1", url: "/uploads/g.jpg", title: "Snake", style: "Fine-line", artistName: "Sarah", sourceUrl: "/gallery" }],
      web: [{ url: "https://i.test/a.jpg", thumbUrl: "https://t.test/a.jpg", sourceUrl: "https://p.test", title: "Peony", width: null, height: null }],
      nextStart: 11,
    };
    const html = renderToStaticMarkup(<InspirationStep state={state} set={set} search={search} />);
    expect(html).toContain("From our studio");
    expect(html).toContain("From the web");
    expect(html).toContain("https://t.test/a.jpg");
    expect(html).toContain("Load more");
    expect(html).toContain("1 of 12");
    expect(html).toContain("Upload");
  });
  it("Inspiration explains when web search is not configured", () => {
    const html = renderToStaticMarkup(
      <InspirationStep state={emptyBuilder()} set={set} search={{ ...idleSearch, status: "done", providerConfigured: false }} />,
    );
    expect(html).toContain("Web search isn");
  });
  it("Details renders placement, size, budget and artists", () => {
    const html = renderToStaticMarkup(<DetailsStep state={emptyBuilder()} set={set} artists={ARTISTS} />);
    expect(html).toContain("Forearm");
    expect(html).toContain("Medium");
    expect(html).toContain("Sarah Boots");
    expect(html).toContain("No preference");
  });
  it("Send renders contact fields; summary reflects the board", () => {
    expect(renderToStaticMarkup(<SendStep state={emptyBuilder()} set={set} />)).toContain("Email");
    const html = renderToStaticMarkup(
      <BoardSummary state={{ ...emptyBuilder(), styles: ["Realism"], items: [linkToItem("https://x.test/a.png")], artistId: "a1" }} artists={ARTISTS} />,
    );
    expect(html).toContain("Realism");
    expect(html).toContain("1 image");
    expect(html).toContain("Sarah Boots");
  });
});
