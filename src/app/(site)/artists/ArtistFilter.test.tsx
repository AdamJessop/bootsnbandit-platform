import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistFilter } from "./ArtistFilter";

describe("ArtistFilter", () => {
  it("renders all filter chips and the initial (unfiltered) grid", () => {
    const html = renderToStaticMarkup(
      <ArtistFilter
        artists={[
          { id: "sarah", name: "Sarah", role: "Co-owner", books: "open" },
          { id: "cal", name: "Calum", role: "Co-owner", books: "limited" },
        ]}
      />,
    );
    expect(html).toContain("Everyone");
    expect(html).toContain("Books open");
    expect(html).toContain("Sarah");
    expect(html).toContain("Calum");
  });
});
