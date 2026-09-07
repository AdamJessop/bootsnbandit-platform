import { describe, expect, it } from "vitest";
import {
  artistInboxWhere,
  attachmentHref,
  buildConvertInput,
  canAccessEnquiry,
  canCloseEnquiry,
  countByStatus,
  distinctStyles,
  filterEnquiries,
  isUnassigned,
  looksLikeImageUrl,
  validateReply,
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

describe("visibility, close authorisation and attachments", () => {
  it("artists see their own enquiries plus every unassigned one, any channel", () => {
    expect(artistInboxWhere("art1")).toEqual({
      OR: [{ preferredArtistId: "art1" }, { preferredArtistId: null }],
    });
  });

  it("isUnassigned / canAccessEnquiry", () => {
    const artist = { role: "ARTIST" as const, artistId: "art1" };
    expect(isUnassigned({ preferredArtistId: null })).toBe(true);
    expect(isUnassigned({ preferredArtistId: "art2" })).toBe(false);
    expect(canAccessEnquiry(artist, { preferredArtistId: null })).toBe(true);
    expect(canAccessEnquiry(artist, { preferredArtistId: "art1" })).toBe(true);
    expect(canAccessEnquiry(artist, { preferredArtistId: "art2" })).toBe(false);
    expect(canAccessEnquiry({ role: "OWNER" }, { preferredArtistId: "art2" })).toBe(true);
    expect(canAccessEnquiry({ role: "ARTIST", artistId: null }, { preferredArtistId: null })).toBe(false);
  });

  it("only the assigned artist (or an owner) may close an enquiry", () => {
    const artist = { role: "ARTIST" as const, artistId: "art1" };
    expect(canCloseEnquiry(artist, { preferredArtistId: "art1" })).toBe(true);
    expect(canCloseEnquiry(artist, { preferredArtistId: null })).toBe(false);
    expect(canCloseEnquiry(artist, { preferredArtistId: "art2" })).toBe(false);
    expect(canCloseEnquiry({ role: "OWNER" }, { preferredArtistId: null })).toBe(true);
  });

  it("counts the customer_replied status", () => {
    expect(countByStatus([{ status: "customer_replied" }, { status: "new" }])).toEqual({
      new: 1,
      replied: 0,
      customer_replied: 1,
      converted: 0,
      closed: 0,
    });
  });

  it("routes inline attachments through the admin origin and links out otherwise", () => {
    expect(attachmentHref({ id: "a1", url: null, hasBytes: true })).toBe(
      "/api/attachments/a1",
    );
    expect(
      attachmentHref({ id: "a2", url: "https://f.test/b.pdf", hasBytes: false }),
    ).toBe("https://f.test/b.pdf");
    expect(attachmentHref({ id: "a3", url: null, hasBytes: false })).toBeNull();
  });
});

describe("filterEnquiries + source filter", () => {
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
