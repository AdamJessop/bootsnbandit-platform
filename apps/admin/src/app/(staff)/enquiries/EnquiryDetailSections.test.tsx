import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MoodBoardBriefSection,
  MoodboardSection,
  ThreadSection,
} from "./EnquiryDetailSections";
import { looksLikeImageUrl, type ThreadEntry } from "./enquiry-helpers";

/**
 * The sections render in the enquiry detail dialog (node test env — no DOM);
 * their branching logic is the pure looksLikeImageUrl helper plus the
 * empty-state guards, asserted here.
 */
describe("EnquiryDetailSections", () => {
  it("exports component functions", () => {
    expect(typeof MoodboardSection).toBe("function");
    expect(typeof ThreadSection).toBe("function");
  });

  it("renders nothing for an empty mood board / thread", () => {
    expect(MoodboardSection({ urls: [] })).toBeNull();
    expect(ThreadSection({ thread: [] })).toBeNull();
  });

  it("returns markup when there is content", () => {
    const thread: ThreadEntry[] = [
      {
        id: "m1",
        type: "staff_reply",
        status: "sent",
        subject: "Re: your enquiry",
        whenISO: "2026-06-01T10:00:00Z",
      },
    ];
    expect(MoodboardSection({ urls: ["https://x.test/a.jpg"] })).not.toBeNull();
    expect(ThreadSection({ thread })).not.toBeNull();
  });

  it("distinguishes image URLs from other references", () => {
    expect(looksLikeImageUrl("https://x.test/moodboard/a.jpg")).toBe(true);
    expect(looksLikeImageUrl("https://x.test/moodboard/a.webp?w=200")).toBe(
      true,
    );
    expect(looksLikeImageUrl("https://pinterest.com/pin/12345")).toBe(false);
  });
});

const DATA = {
  version: 1 as const,
  styles: ["Fine-line"],
  colour: "bw" as const,
  description: "peony",
  query: "peony fine-line black and grey tattoo",
  notes: "wrap it",
  items: [
    {
      kind: "web" as const,
      url: "https://i.test/a.jpg",
      thumbUrl: "https://t.test/a.jpg",
      sourceUrl: "https://p.test/a",
      title: "Peony",
      assetId: null,
      galleryItemId: null,
    },
    {
      kind: "upload" as const,
      url: "https://site.test/api/inkling/assets/a1",
      thumbUrl: null,
      sourceUrl: null,
      title: "mine.jpg",
      assetId: "a1",
      galleryItemId: null,
    },
  ],
};

it("brief section renders styles/colour/query; board renders kind badges + source links", () => {
  const brief = renderToStaticMarkup(<MoodBoardBriefSection data={DATA} />);
  expect(brief).toContain("Fine-line");
  expect(brief).toContain("Black &amp; grey");
  expect(brief).toContain("peony fine-line");
  expect(MoodBoardBriefSection({ data: null })).toBeNull();

  const board = renderToStaticMarkup(
    <MoodboardSection urls={DATA.items.map((i) => i.url)} data={DATA} />,
  );
  expect(board).toContain("https://t.test/a.jpg");
  expect(board).toContain("https://p.test/a");
  expect(board).toContain("Web");
  expect(board).toContain("Upload");
});
