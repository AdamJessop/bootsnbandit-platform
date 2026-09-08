import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxFilters } from "./InboxFilters";

describe("InboxFilters", () => {
  it("renders every status tab with its count and label-bearing selects", () => {
    const html = renderToStaticMarkup(
      <InboxFilters
        tab="new"
        onTabChange={vi.fn()}
        counts={{
          new: 3,
          customer_replied: 2,
          replied: 1,
          converted: 0,
          closed: 7,
        }}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        styles={["fine line"]}
        artistFilter="__all__"
        styleFilter="__all__"
        sourceFilter="__all__"
        onArtistFilter={vi.fn()}
        onStyleFilter={vi.fn()}
        onSourceFilter={vi.fn()}
      />,
    );
    expect(html).toContain("Customer replied");
    expect(html).toContain("Closed");
    const triggers = [
      ...html.matchAll(/data-slot="select-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(triggers).toContain("All artists");
    expect(triggers).not.toContain("__all__");
  });

  it("explains that a tab count is the total, not the filtered list", () => {
    // A Closed tab reading 7 above two rows looks like a bug until you know
    // the dropdowns narrow the rows and never the count.
    const html = renderToStaticMarkup(
      <InboxFilters
        tab="new"
        onTabChange={vi.fn()}
        counts={{
          new: 3,
          customer_replied: 2,
          replied: 1,
          converted: 0,
          closed: 7,
        }}
        artists={[]}
        styles={[]}
        artistFilter="__all__"
        styleFilter="__all__"
        sourceFilter="__all__"
        onArtistFilter={vi.fn()}
        onStyleFilter={vi.fn()}
        onSourceFilter={vi.fn()}
      />,
    );
    expect(html).toContain(
      'title="7 in total — filters narrow the list only"',
    );
    expect(html).toContain(
      'aria-label="7 in total — filters narrow the list only"',
    );
  });
});
