import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GalleryBrowser } from "./GalleryBrowser";

const ITEMS = [
  {
    id: "1",
    title: "Ornamental snake",
    style: "Fine-line",
    placement: "Calf",
    artistSlug: "sarah",
    artistName: "Sarah",
    big: true,
  },
  {
    id: "2",
    title: "Pennywise portrait",
    style: "Realism",
    placement: "Upper arm",
    artistSlug: "cal",
    artistName: "Calum",
    big: false,
  },
];

describe("GalleryBrowser", () => {
  it("renders style + artist filter chips, the count and the tiles", () => {
    const html = renderToStaticMarkup(
      <GalleryBrowser
        items={ITEMS}
        styles={["Fine-line", "Realism"]}
        artists={[
          { slug: "sarah", name: "Sarah" },
          { slug: "cal", name: "Calum" },
        ]}
      />,
    );
    expect(html).toContain("Fine-line");
    expect(html).toContain("Sarah");
    expect(html).toContain("2 pieces");
    expect(html).toContain("Ornamental snake");
    expect(html).toContain("Pennywise portrait");
  });
});
