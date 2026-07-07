import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../enquire/enquire.module.css", () => ({ default: {} }));

const { MoodBoard } = await import("./MoodBoard");

const ARTISTS = [
  {
    id: "a1",
    name: "Sarah Boots",
    role: "Co-owner",
    slug: "sarah",
    booksStatus: "open" as const,
  },
];

describe("Inkling MoodBoard", () => {
  it("renders the URL-based reference capture and contact fields", () => {
    const html = renderToStaticMarkup(<MoodBoard artists={ARTISTS} />);
    expect(html).toContain("Mood Board");
    expect(html).toContain("Reference links");
    expect(html).toContain("https://…");
    expect(html).toContain("Send to");
    expect(html).toContain("Sarah Boots");
    // The old fake placeholder button is gone.
    expect(html).not.toContain("Add a reference");
  });
});
