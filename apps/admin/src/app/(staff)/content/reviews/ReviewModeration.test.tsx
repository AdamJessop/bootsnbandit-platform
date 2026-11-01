import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The island imports the server action (server-only auth) transitively; stub
// the boundary so the graph loads under node.
vi.mock("./actions", () => ({ moderateReviewAction: vi.fn() }));

import { ReviewCard, ReviewModeration } from "./ReviewModeration";
import type { ReviewRow } from "./review-view";

function row(over: Partial<ReviewRow>): ReviewRow {
  return {
    id: "r1",
    status: "submitted",
    rating: 4,
    body: "Proper job, would go back.",
    customerName: "Hannah M",
    artistName: "Calum",
    submittedLabel: "12 Oct 2026",
    ...over,
  };
}

const noop = () => {};

describe("ReviewModeration", () => {
  it("opens on Awaiting with per-tab counts and only that tab's reviews", () => {
    const html = renderToStaticMarkup(
      <ReviewModeration
        reviews={[
          row({ id: "a", customerName: "Waiting One" }),
          row({ id: "b", status: "published", customerName: "Live One" }),
          row({ id: "c", status: "hidden", customerName: "Binned One" }),
        ]}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Awaiting");
    expect(html).toContain("Waiting One");
    expect(html).not.toContain("Live One");
    expect(html).not.toContain("Binned One");
  });

  it("says so when nothing is waiting", () => {
    const html = renderToStaticMarkup(<ReviewModeration reviews={[]} />);
    expect(html).toContain("Nothing waiting");
  });
});

describe("ReviewCard", () => {
  it("shows the customer, artist, stars, words and date with Publish / Hide", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        review={row({})}
        armed={null}
        onAction={noop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("Hannah M");
    expect(html).toContain("with Calum");
    expect(html).toContain('aria-label="4 out of 5 stars"');
    expect(html).toContain("★★★★☆");
    expect(html).toContain("Proper job, would go back.");
    expect(html).toContain("12 Oct 2026");
    expect(html).toContain("Publish");
    expect(html).toContain("Hide");
    expect(html).not.toContain("Unpublish");
  });

  it("offers Unpublish on a published review", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        review={row({ status: "published" })}
        armed={null}
        onAction={noop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("Unpublish");
  });

  it("asks inline before hiding, replacing the action buttons", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        review={row({})}
        armed="hide"
        onAction={noop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Hide this review?");
    expect(html).toContain("Yes, hide");
    expect(html).toContain("Keep it");
    expect(html).not.toContain(">Publish<");
  });

  it("flags a rating-only review as one the homepage won't quote", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        review={row({ body: null })}
        armed={null}
        onAction={noop}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("Rating only");
  });
});
