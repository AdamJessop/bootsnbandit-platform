import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CustomerTimeline,
  sortTimeline,
  type TimelineEntry,
} from "./CustomerTimeline";

describe("CustomerTimeline contract", () => {
  it("is a component function", () => {
    expect(typeof CustomerTimeline).toBe("function");
  });

  it("sorts entries newest-first by timestamp", () => {
    const entries: TimelineEntry[] = [
      {
        id: "1",
        kind: "enquiry",
        at: "2026-01-01T00:00:00Z",
        title: "Enquiry",
      },
      {
        id: "2",
        kind: "session",
        at: "2026-03-01T00:00:00Z",
        title: "Session",
      },
      {
        id: "3",
        kind: "booking",
        at: "2026-02-01T00:00:00Z",
        title: "Booking",
      },
    ];
    expect(sortTimeline(entries).map((e) => e.id)).toEqual(["2", "3", "1"]);
  });

  it("does not mutate the input", () => {
    const entries: TimelineEntry[] = [
      { id: "a", kind: "note", at: "2026-01-01T00:00:00Z", title: "A" },
      { id: "b", kind: "note", at: "2026-02-01T00:00:00Z", title: "B" },
    ];
    const copy = [...entries];
    sortTimeline(entries);
    expect(entries).toEqual(copy);
  });

  it("renders a message entry as a link with its channel", () => {
    const html = renderToStaticMarkup(
      <CustomerTimeline
        customerId="c1"
        entries={[
          {
            id: "message-m1",
            kind: "message",
            channel: "messenger",
            at: "2026-09-05T09:00:00.000Z",
            title: "Messenger · Received",
            detail: "Is Tuesday free?",
            href: "/enquiries?open=e1",
          },
        ]}
      />,
    );
    expect(html).toContain('href="/enquiries?open=e1"');
    expect(html).toContain("Messenger · Received");
    expect(html).toContain("Is Tuesday free?");
  });
});
