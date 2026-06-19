import { describe, expect, it } from "vitest";
import { buildTimeline, type TimelineSources } from "./timeline-builder";

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
