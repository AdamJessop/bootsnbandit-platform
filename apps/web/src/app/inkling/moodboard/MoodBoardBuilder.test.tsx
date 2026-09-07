import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../enquire/enquire.module.css", () => ({ default: {} }));
vi.mock("./moodboard.module.css", () => ({ default: {} }));
const { MoodBoardBuilder } = await import("./MoodBoardBuilder");

describe("MoodBoardBuilder", () => {
  it("renders the stepper on the Brief step with the summary aside", () => {
    const html = renderToStaticMarkup(
      <MoodBoardBuilder artists={[]} styleOptions={["Fine-line"]} />,
    );
    expect(html).toContain("Brief");
    expect(html).toContain("Inspiration");
    expect(html).toContain("Details");
    expect(html).toContain("Send");
    expect(html).toContain("Your board");
    expect(html).not.toContain("Reference links");
  });
});
