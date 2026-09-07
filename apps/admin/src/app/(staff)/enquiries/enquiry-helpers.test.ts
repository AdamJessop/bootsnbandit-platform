import { describe, expect, it } from "vitest";
import {
  artistInboxWhere,
  buildConvertInput,
  buildThreadMap,
  canAccessEnquiry,
  distinctStyles,
  filterEnquiries,
  isOpenBoard,
  looksLikeImageUrl,
  validateReply,
  type ThreadMessage,
} from "./enquiry-helpers";

describe("looksLikeImageUrl", () => {
  it("matches common image extensions (query strings included)", () => {
    expect(looksLikeImageUrl("https://x.test/a.jpg")).toBe(true);
    expect(looksLikeImageUrl("https://x.test/a.JPEG")).toBe(true);
    expect(looksLikeImageUrl("https://x.test/a.webp?w=100&h=100")).toBe(true);
    expect(looksLikeImageUrl("/uploads/moodboard/a.png")).toBe(true);
  });

  it("rejects non-image references", () => {
    expect(looksLikeImageUrl("https://pinterest.com/pin/123")).toBe(false);
    expect(looksLikeImageUrl("https://x.test/a.pdf")).toBe(false);
    expect(looksLikeImageUrl("not a url")).toBe(false);
  });
});

describe("buildThreadMap", () => {
  const msg = (over: Partial<ThreadMessage>): ThreadMessage => ({
    id: "m1",
    customerId: "c1",
    type: "staff_reply",
    status: "sent",
    subject: "Re: enquiry",
    sentAtISO: "2026-06-01T10:00:00Z",
    createdAtISO: "2026-06-01T09:59:00Z",
    ...over,
  });

  it("groups messages per customer, preserving order", () => {
    const map = buildThreadMap([
      msg({ id: "m1", customerId: "c1" }),
      msg({ id: "m2", customerId: "c2" }),
      msg({ id: "m3", customerId: "c1", type: "enquiry_ack" }),
    ]);
    expect(map.get("c1")?.map((t) => t.id)).toEqual(["m1", "m3"]);
    expect(map.get("c2")?.map((t) => t.id)).toEqual(["m2"]);
  });

  it("uses sentAt when present, else createdAt, and skips customer-less rows", () => {
    const map = buildThreadMap([
      msg({ id: "m1", sentAtISO: null }),
      msg({ id: "m2", customerId: null }),
    ]);
    expect(map.get("c1")).toEqual([
      expect.objectContaining({ id: "m1", whenISO: "2026-06-01T09:59:00Z" }),
    ]);
    expect(map.size).toBe(1);
  });

  it("caps each customer's thread", () => {
    const many = Array.from({ length: 5 }, (_, i) => msg({ id: `m${i}` }));
    expect(buildThreadMap(many, 3).get("c1")).toHaveLength(3);
  });
});

describe("filterEnquiries + distinctStyles", () => {
  const items = [
    { id: "1", preferredArtistId: "a1", style: "Fine line" },
    { id: "2", preferredArtistId: "a2", style: "fine line" },
    { id: "3", preferredArtistId: null, style: "Blackwork" },
    { id: "4", preferredArtistId: "a1", style: null },
  ];

  it("passes everything through with no filters", () => {
    expect(
      filterEnquiries(items, { artistId: null, style: null, source: null }),
    ).toHaveLength(4);
  });

  it("filters by preferred artist", () => {
    expect(
      filterEnquiries(items, {
        artistId: "a1",
        style: null,
        source: null,
      }).map((i) => i.id),
    ).toEqual(["1", "4"]);
  });

  it("filters by style case-insensitively, and combines with artist", () => {
    expect(
      filterEnquiries(items, {
        artistId: null,
        style: "fine line",
        source: null,
      }).map((i) => i.id),
    ).toEqual(["1", "2"]);
    expect(
      filterEnquiries(items, {
        artistId: "a2",
        style: "FINE LINE",
        source: null,
      }).map((i) => i.id),
    ).toEqual(["2"]);
  });

  it("derives distinct styles (case-insensitive, sorted, no blanks)", () => {
    expect(distinctStyles(items)).toEqual(["Blackwork", "Fine line"]);
  });
});

describe("validateReply", () => {
  it("requires a non-empty message", () => {
    expect(validateReply({ message: "  " }).ok).toBe(false);
    expect(validateReply({ message: "Hi there" })).toEqual({
      ok: true,
      message: "Hi there",
    });
  });
});

describe("buildConvertInput", () => {
  const base = {
    customerId: "c1",
    artistId: "a1",
    startISO: "2026-07-01T10:00:00.000Z",
    durationMin: 90,
    type: "consult" as const,
    style: "traditional",
    placement: "forearm",
  };

  it("computes end from start + duration and carries style/placement", () => {
    const r = buildConvertInput(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.start.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(r.input.end.toISOString()).toBe("2026-07-01T11:30:00.000Z");
    expect(r.input.durationMin).toBe(90);
    expect(r.input.style).toBe("traditional");
    expect(r.input.status).toBe("pending");
  });

  it("fails on a missing artist", () => {
    expect(buildConvertInput({ ...base, artistId: "" }).ok).toBe(false);
  });

  it("fails on an invalid date", () => {
    expect(buildConvertInput({ ...base, startISO: "nope" }).ok).toBe(false);
  });

  it("fails on a non-positive duration", () => {
    expect(buildConvertInput({ ...base, durationMin: 0 }).ok).toBe(false);
  });
});

describe("artist scope + open boards", () => {
  it("artists see their own enquiries plus unassigned Inkling boards", () => {
    expect(artistInboxWhere("art1")).toEqual({
      OR: [
        { preferredArtistId: "art1" },
        { source: "inkling", preferredArtistId: null },
      ],
    });
  });

  it("isOpenBoard / canAccessEnquiry", () => {
    const open = { source: "inkling" as const, preferredArtistId: null };
    const mine = { source: "web" as const, preferredArtistId: "art1" };
    const other = { source: "web" as const, preferredArtistId: "art2" };
    expect(isOpenBoard(open)).toBe(true);
    expect(isOpenBoard({ source: "web", preferredArtistId: null })).toBe(false);
    const artist = { role: "ARTIST" as const, artistId: "art1" };
    expect(canAccessEnquiry(artist, open)).toBe(true);
    expect(canAccessEnquiry(artist, mine)).toBe(true);
    expect(canAccessEnquiry(artist, other)).toBe(false);
    expect(canAccessEnquiry({ role: "OWNER" }, other)).toBe(true);
    expect(canAccessEnquiry({ role: "ARTIST", artistId: null }, open)).toBe(
      false,
    );
  });

  it("filterEnquiries honours the source filter", () => {
    const items = [
      { preferredArtistId: null, style: null, source: "inkling" as const },
      { preferredArtistId: null, style: null, source: "web" as const },
    ];
    expect(
      filterEnquiries(items, {
        artistId: null,
        style: null,
        source: "inkling",
      }),
    ).toHaveLength(1);
    expect(
      filterEnquiries(items, { artistId: null, style: null, source: null }),
    ).toHaveLength(2);
  });
});
