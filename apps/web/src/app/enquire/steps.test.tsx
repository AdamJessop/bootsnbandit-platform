import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyWizardState } from "./logic";

vi.mock("./enquire.module.css", () => ({ default: {} }));

const { DetailsStep, IdeaStep, MoodStep } = await import("./steps");

describe("IdeaStep", () => {
  it("asks for styles, subject, placement and size on a normal enquiry", () => {
    const html = renderToStaticMarkup(
      <IdeaStep
        styleOptions={["Fine-line"]}
        state={emptyWizardState()}
        set={() => {}}
      />,
    );
    expect(html).toContain("Your idea");
    expect(html).toContain("Fine-line");
    expect(html).toContain("Rough size");
    expect(html).toContain('id="placement"');
  });

  it("collapses to placement + optional notes on a flash claim", () => {
    const html = renderToStaticMarkup(
      <IdeaStep
        styleOptions={["Fine-line"]}
        state={emptyWizardState()}
        set={() => {}}
        flash={{
          id: "f1",
          title: "Pearl Shell",
          artistId: "a1",
          pricePence: 13000,
          size: "~11cm",
        }}
      />,
    );
    expect(html).toContain("Pearl Shell is already drawn at ~11cm");
    expect(html).toContain('id="placement"');
    expect(html).toContain("Notes (optional)");
    expect(html).not.toContain("Fine-line");
    expect(html).not.toContain("Rough size");
  });
});

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
