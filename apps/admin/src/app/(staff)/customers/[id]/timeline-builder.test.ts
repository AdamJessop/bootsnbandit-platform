import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  messagePreview,
  type TimelineSources,
} from "./timeline-builder";

const sources: TimelineSources = {
  enquiries: [
    {
      id: "e1",
      createdAt: "2026-01-01T10:00:00Z",
      style: "traditional",
      status: "new",
    },
  ],
  bookings: [
    {
      id: "b1",
      start: "2026-02-01T10:00:00Z",
      type: "session",
      status: "confirmed",
      artistName: "Boots",
    },
  ],
  sessions: [
    {
      id: "s1",
      completedAt: "2026-02-01T12:00:00Z",
      amountChargedPence: 12500,
      tipPence: 1000,
    },
  ],
  messages: [
    {
      id: "m1",
      sentAt: "2026-02-01T12:05:00Z",
      createdAt: "2026-02-01T12:05:00Z",
      type: "receipt",
      status: "sent",
      subject: "Your receipt",
    },
  ],
  loyalty: { stamps: 3, tier: 1 },
};

describe("buildTimeline", () => {
  it("merges every source into one stream, newest first", () => {
    const entries = buildTimeline(sources);
    // 1 enquiry + 1 booking + 1 session + 1 email = 4
    expect(entries).toHaveLength(4);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("enquiry");
    expect(kinds).toContain("booking");
    expect(kinds).toContain("session");
    expect(kinds).toContain("email");
    // newest first
    const times = entries.map((e) => new Date(e.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("formats the session amount in the detail", () => {
    const session = buildTimeline(sources).find((e) => e.kind === "session");
    expect(session?.detail).toContain("£125.00");
  });

  it("falls back to createdAt when a message has no sentAt", () => {
    const entries = buildTimeline({
      ...sources,
      messages: [
        {
          id: "m2",
          sentAt: null,
          createdAt: "2026-03-01T00:00:00Z",
          type: "reminder",
          status: "logged",
          subject: null,
        },
      ],
    });
    const email = entries.find((e) => e.kind === "email");
    expect(email?.at).toBe("2026-03-01T00:00:00Z");
  });
});

const EMPTY = {
  enquiries: [],
  bookings: [],
  sessions: [],
  messages: [],
  threadMessages: [],
  loyalty: { stamps: 0, tier: 0 },
};

describe("messagePreview", () => {
  it("collapses whitespace and truncates long bodies", () => {
    expect(messagePreview("  hello\n\n  there  ")).toBe("hello there");
    expect(messagePreview("x".repeat(200))).toHaveLength(121); // 120 + ellipsis
    expect(messagePreview("x".repeat(200)).endsWith("…")).toBe(true);
  });

  it("survives an empty body", () => {
    expect(messagePreview("")).toBe("");
  });

  it("never cuts an emoji in half at the boundary", () => {
    // "🎨" is a surrogate PAIR: slicing by UTF-16 code unit at the cut point
    // leaves a lone high surrogate, which renders as U+FFFD (the black
    // diamond) in the timeline row.
    const body = `${"x".repeat(119)}🎨tail`;
    const preview = messagePreview(body);
    expect(preview).toBe(`${"x".repeat(119)}🎨…`);
    expect(preview).not.toContain("�");
    // No lone surrogate anywhere in the output.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(preview)).toBe(false);
  });

  it("counts code points, not code units, when deciding to truncate at all", () => {
    // 120 emoji is 240 UTF-16 units but exactly the cap — nothing to cut.
    const body = "🎨".repeat(120);
    expect(messagePreview(body)).toBe(body);
    expect(messagePreview("🎨".repeat(121)).endsWith("…")).toBe(true);
  });
});

describe("buildTimeline thread messages", () => {
  it("adds inbound and outbound messages with channel, direction and a deep link", () => {
    const entries = buildTimeline({
      ...EMPTY,
      threadMessages: [
        {
          id: "m1",
          enquiryId: "e1",
          createdAt: "2026-09-05T09:00:00.000Z",
          direction: "inbound",
          channel: "instagram",
          bodyText: "Is Tuesday free?",
        },
        {
          id: "m2",
          enquiryId: "e1",
          createdAt: "2026-09-05T10:00:00.000Z",
          direction: "outbound",
          channel: "email",
          bodyText: "Tuesday works!",
        },
      ],
    });
    expect(entries.map((e) => e.id)).toEqual(["message-m2", "message-m1"]);
    expect(entries[1]).toMatchObject({
      kind: "message",
      channel: "instagram",
      title: "Instagram · Received",
      detail: "Is Tuesday free?",
      href: "/enquiries?open=e1",
    });
    expect(entries[0].title).toBe("Email · Sent");
  });

  it("never puts internal staff notes on the customer's own record", () => {
    const entries = buildTimeline({
      ...EMPTY,
      threadMessages: [
        {
          id: "m3",
          enquiryId: "e1",
          createdAt: "2026-09-05T09:00:00.000Z",
          direction: "internal",
          channel: "note",
          bodyText: "Difficult on the phone",
        },
      ],
    });
    expect(entries).toEqual([]);
  });

  it("links enquiry entries into the inbox", () => {
    const entries = buildTimeline({
      ...EMPTY,
      enquiries: [
        {
          id: "e9",
          createdAt: "2026-09-01T09:00:00.000Z",
          style: "fine line",
          status: "new",
        },
      ],
    });
    expect(entries[0].href).toBe("/enquiries?open=e9");
  });
});
