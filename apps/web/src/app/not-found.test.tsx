import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound, { metadata } from "./not-found";

describe("NotFound", () => {
  it("renders the branded 404 with a link home", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("404");
    expect(html).toContain("Lost the trail");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/enquire"');
  });

  it("titles the page for the public site", () => {
    expect(metadata.title).toContain("not found");
  });
});
