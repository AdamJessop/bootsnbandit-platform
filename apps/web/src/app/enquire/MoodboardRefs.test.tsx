import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./enquire.module.css", () => ({ default: {} }));

const { MoodboardRefs } = await import("./MoodboardRefs");

describe("MoodboardRefs", () => {
  it("renders the URL input and empty state", () => {
    const html = renderToStaticMarkup(
      <MoodboardRefs refs={[]} onChange={() => {}} />,
    );
    expect(html).toContain("Reference links");
    expect(html).toContain("https://…");
    expect(html).toContain("No references yet");
  });

  it("renders added references as removable link tiles", () => {
    const html = renderToStaticMarkup(
      <MoodboardRefs
        refs={["https://example.com/ink.jpg"]}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('href="https://example.com/ink.jpg"');
    expect(html).toContain("example.com/ink.jpg");
    expect(html).toContain("Remove reference");
    expect(html).not.toContain("No references yet");
  });
});
