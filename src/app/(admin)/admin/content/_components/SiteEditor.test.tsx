import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteEditor } from "./SiteEditor";

describe("SiteEditor", () => {
  it("renders studio fields, ticker lines and the enquiries toggle", () => {
    const html = renderToStaticMarkup(
      <SiteEditor
        action={vi.fn()}
        values={{
          studioName: "Boots 'n' Bandit",
          addressLine: "1 High St",
          city: "Worksop",
          county: null,
          postcode: "S80 1AB",
          hoursText: "Tue–Sat 10–6",
          phone: null,
          email: null,
          licensingText: null,
          facebookUrl: null,
          instagramUrl: "https://instagram.com/bnb",
          tickerLines: ["Walk-ins welcome", "Flash Friday"],
          enquiriesOpen: true,
          visualDirection: "heritage",
        }}
      />,
    );
    expect(html).toContain("Boots &#x27;n&#x27; Bandit");
    expect(html).toContain("Walk-ins welcome\nFlash Friday");
    expect(html).toContain('name="enquiriesOpen"');
  });
});
