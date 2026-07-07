import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyWizardState } from "./logic";

vi.mock("./enquire.module.css", () => ({ default: {} }));

const { DetailsStep, MoodStep } = await import("./steps");

describe("DetailsStep", () => {
  it("renders the optional budget input with preset chips", () => {
    const html = renderToStaticMarkup(
      <DetailsStep state={emptyWizardState()} set={() => {}} />,
    );
    expect(html).toContain("Rough budget");
    expect(html).toContain('id="budget"');
    expect(html).toContain("£150");
  });

  it("reflects a typed budget value", () => {
    const html = renderToStaticMarkup(
      <DetailsStep
        state={{ ...emptyWizardState(), budget: "250" }}
        set={() => {}}
      />,
    );
    expect(html).toContain('value="250"');
  });
});

describe("MoodStep", () => {
  it("renders the URL-based reference capture", () => {
    const html = renderToStaticMarkup(
      <MoodStep refs={[]} onChange={() => {}} />,
    );
    expect(html).toContain("Mood board");
    expect(html).toContain("Reference links");
  });
});
