import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StyleShowcase } from "./StyleShowcase";

describe("StyleShowcase", () => {
  it("falls back to the abstract plate when no styles have images", () => {
    const html = renderToStaticMarkup(<StyleShowcase styles={[]} />);
    expect(html).toContain("plate-art");
    expect(html).not.toContain("style-showcase");
  });

  it("renders a 2-column tile grid linking to the matcher for up to 4 styles", () => {
    const html = renderToStaticMarkup(
      <StyleShowcase
        styles={[
          { name: "Blackwork", image: "/uploads/styles/blackwork.jpg" },
          { name: "Fine-line", image: "/uploads/styles/fineline.jpg" },
        ]}
      />,
    );
    expect(html).toContain('href="/inkling?tab=match"');
    expect(html).toContain('data-cols="2"');
    expect(html).toContain('src="/uploads/styles/blackwork.jpg"');
    expect(html).toContain('alt="Blackwork tattoo example"');
    expect(html).toContain("Fine-line");
  });

  it("uses 3 columns for more than 4 styles and caps tiles at 9", () => {
    const styles = Array.from({ length: 11 }, (_, i) => ({
      name: `Style ${i + 1}`,
      image: `/uploads/styles/s${i + 1}.jpg`,
    }));
    const html = renderToStaticMarkup(<StyleShowcase styles={styles} />);
    expect(html).toContain('data-cols="3"');
    expect(html).toContain("Style 9");
    expect(html).not.toContain("Style 10");
  });
});
