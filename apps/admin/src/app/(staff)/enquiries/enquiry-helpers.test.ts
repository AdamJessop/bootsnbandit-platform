import { describe, expect, it } from "vitest";
import {
  artistInboxWhere,
  attachmentHref,
  buildConvertInput,
  canAccessEnquiry,
  canCloseEnquiry,
  chooseReplyChannel,
  countByStatus,
  defaultComposerChannel,
  distinctStyles,
  filterEnquiries,
  isUnassigned,
  looksLikeImageUrl,
  replyChannelOptions,
  resolveComposerChannel,
  validateReply,
  type ReplyReachability,
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

  it("an artist user with no artist record sees nothing (matches visibleEnquiryWhere)", () => {
    expect(artistInboxWhere(null)).toEqual({ id: "__none__" });
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

describe("chooseReplyChannel", () => {
  it("replies on the Meta channel the customer last used, when it is live", () => {
    expect(
      chooseReplyChannel({
        lastInboundChannel: "messenger",
        hasEmail: true,
        metaTargetReady: true,
      }),
    ).toBe("messenger");
    expect(
      chooseReplyChannel({
        lastInboundChannel: "instagram",
        hasEmail: false,
        metaTargetReady: true,
      }),
    ).toBe("instagram");
  });

  it("falls back to email when the Meta route is not usable", () => {
    // Page disconnected, token unreadable, or a message from before
    // connections existed: the words must still reach the customer.
    expect(
      chooseReplyChannel({
        lastInboundChannel: "messenger",
        hasEmail: true,
        metaTargetReady: false,
      }),
    ).toBe("email");
    expect(
      chooseReplyChannel({
        lastInboundChannel: "instagram",
        hasEmail: false,
        metaTargetReady: false,
      }),
    ).toBe("none");
  });

  it("replies by email for every non-Meta thread with an address", () => {
    for (const lastInboundChannel of ["email", "web", "note", null] as const) {
      expect(
        chooseReplyChannel({
          lastInboundChannel,
          hasEmail: true,
          metaTargetReady: true,
        }),
      ).toBe("email");
    }
  });

  it("has no reachable channel without an address or a Meta route", () => {
    expect(
      chooseReplyChannel({
        lastInboundChannel: "email",
        hasEmail: false,
        metaTargetReady: false,
      }),
    ).toBe("none");
    expect(
      chooseReplyChannel({
        lastInboundChannel: null,
        hasEmail: false,
        metaTargetReady: false,
      }),
    ).toBe("none");
  });
});

const NOW = Date.parse("2026-09-08T12:00:00.000Z");
/** The customer wrote at 09:00, so the window shuts the next day at 09:00. */
const OPEN_UNTIL = "2026-09-09T09:00:00.000Z";
const SHUT_AT = "2026-09-07T09:00:00.000Z";

const EMAIL_ONLY: ReplyReachability = {
  contactEmail: "amy@example.test",
  metaChannel: null,
  metaTargetReady: false,
  metaWindowClosesAtISO: null,
};
const LIVE_MESSENGER: ReplyReachability = {
  contactEmail: "amy@example.test",
  metaChannel: "messenger",
  metaTargetReady: true,
  metaWindowClosesAtISO: OPEN_UNTIL,
};

function option(reach: ReplyReachability, channel: string) {
  return replyChannelOptions(reach, NOW).find((o) => o.channel === channel)!;
}

describe("replyChannelOptions", () => {
  it("always offers all four channels, in a stable order", () => {
    expect(replyChannelOptions(EMAIL_ONLY, NOW).map((o) => o.channel)).toEqual([
      "email",
      "messenger",
      "instagram",
      "note",
    ]);
  });

  it("names the address email will go to, and refuses when there is none", () => {
    expect(option(EMAIL_ONLY, "email")).toMatchObject({
      available: true,
      label: "Email",
    });
    expect(option(EMAIL_ONLY, "email").hint).toContain("amy@example.test");
    const noEmail = option({ ...EMAIL_ONLY, contactEmail: null }, "email");
    expect(noEmail.available).toBe(false);
    expect(noEmail.hint).toBe("No email address on file for this customer.");
  });

  it("offers only the Meta channel this thread actually arrived on", () => {
    expect(option(LIVE_MESSENGER, "messenger").available).toBe(true);
    const ig = option(LIVE_MESSENGER, "instagram");
    expect(ig.available).toBe(false);
    expect(ig.hint).toBe("No Instagram conversation on this thread.");
  });

  it("says when the Page behind a Meta thread is not connected", () => {
    const dead = option(
      { ...LIVE_MESSENGER, metaTargetReady: false },
      "messenger",
    );
    expect(dead.available).toBe(false);
    expect(dead.hint).toBe(
      "That Page is not connected — reconnect it in Studio › Channels.",
    );
  });

  it("shows the closing time of an open window and of a shut one", () => {
    expect(option(LIVE_MESSENGER, "messenger").hint).toMatch(
      /^Open until 09 Sep/,
    );
    const shut = option(
      { ...LIVE_MESSENGER, metaWindowClosesAtISO: SHUT_AT },
      "messenger",
    );
    expect(shut.available).toBe(false);
    // `Sept?` because en-GB's short month is "Sep" on older ICU and "Sept" on
    // newer — the assertion is about naming the day, not about the spelling.
    expect(shut.hint).toMatch(
      /^The 24-hour reply window closed at 07 Sept? .* — reply by email instead\.$/,
    );
  });

  it("counts the instant the window shuts as shut, matching isWithinSendWindow", () => {
    // `isWithinSendWindow` in @bnb/core is a strict `<`: at exactly 24 hours
    // the window is closed. If this boundary drifted the other way the
    // composer would offer a send Meta is about to reject.
    const onTheDot = { ...LIVE_MESSENGER, metaWindowClosesAtISO: OPEN_UNTIL };
    const closesAtMs = Date.parse(OPEN_UNTIL);
    expect(
      replyChannelOptions(onTheDot, closesAtMs - 1).find(
        (o) => o.channel === "messenger",
      )!.available,
    ).toBe(true);
    expect(
      replyChannelOptions(onTheDot, closesAtMs).find(
        (o) => o.channel === "messenger",
      )!.available,
    ).toBe(false);
  });

  it("treats a Meta thread with no inbound timestamp as shut, not as open", () => {
    const none = option(
      { ...LIVE_MESSENGER, metaWindowClosesAtISO: null },
      "messenger",
    );
    expect(none.available).toBe(false);
    expect(none.hint).toBe(
      "The 24-hour reply window is closed — reply by email instead.",
    );
  });

  it("always offers the internal note", () => {
    const note = option(
      {
        contactEmail: null,
        metaChannel: null,
        metaTargetReady: false,
        metaWindowClosesAtISO: null,
      },
      "note",
    );
    expect(note).toMatchObject({
      available: true,
      label: "Internal note",
      hint: "Saved on the thread for staff only — never sent.",
    });
  });
});

describe("defaultComposerChannel", () => {
  it("prefers the live Meta channel the customer last used", () => {
    expect(defaultComposerChannel(LIVE_MESSENGER, NOW)).toBe("messenger");
  });

  it("falls back to email when the Meta window has shut", () => {
    expect(
      defaultComposerChannel(
        { ...LIVE_MESSENGER, metaWindowClosesAtISO: SHUT_AT },
        NOW,
      ),
    ).toBe("email");
  });

  it("falls back to the internal note when nothing can be sent", () => {
    expect(
      defaultComposerChannel(
        {
          contactEmail: null,
          metaChannel: "instagram",
          metaTargetReady: false,
          metaWindowClosesAtISO: null,
        },
        NOW,
      ),
    ).toBe("note");
  });
});

describe("resolveComposerChannel", () => {
  it("uses the default when the caller asked for nothing", () => {
    expect(resolveComposerChannel(null, LIVE_MESSENGER, NOW)).toEqual({
      ok: true,
      channel: "messenger",
    });
  });

  it("honours a reachable override", () => {
    expect(resolveComposerChannel("email", LIVE_MESSENGER, NOW)).toEqual({
      ok: true,
      channel: "email",
    });
  });

  it("refuses an unreachable override with that option's own reason", () => {
    const shut = { ...LIVE_MESSENGER, metaWindowClosesAtISO: SHUT_AT };
    const res = resolveComposerChannel("messenger", shut, NOW);
    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: option(shut, "messenger").hint });
  });

  it("refuses a value that is not a channel at all", () => {
    expect(
      resolveComposerChannel("carrier-pigeon", LIVE_MESSENGER, NOW),
    ).toEqual({
      ok: false,
      error: "Choose a channel to reply on.",
    });
  });
});
