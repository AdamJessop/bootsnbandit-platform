import { describe, expect, it } from "vitest";
import { MoodboardSection, ThreadSection } from "./EnquiryDetailSections";
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
