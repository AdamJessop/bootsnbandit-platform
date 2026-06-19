import { describe, expect, it } from "vitest";
import { coerceArtist, poundsToPence, penceToPounds } from "./artist-form";

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) for (const item of v) f.append(k, item);
    else f.set(k, v);
  }
  return f;
}

describe("poundsToPence / penceToPounds", () => {
  it("converts pounds to integer pence", () => {
    expect(poundsToPence("90")).toBe(9000);
    expect(poundsToPence("90.5")).toBe(9050);
    expect(poundsToPence("90.555")).toBe(9056);
  });
  it("returns null for blank/invalid", () => {
    expect(poundsToPence("")).toBeNull();
    expect(poundsToPence("  ")).toBeNull();
    expect(poundsToPence("abc")).toBeNull();
  });
  it("formats pence back to a pounds string", () => {
    expect(penceToPounds(9000)).toBe("90");
    expect(penceToPounds(9050)).toBe("90.50");
    expect(penceToPounds(null)).toBe("");
    expect(penceToPounds(undefined)).toBe("");
  });
});

describe("coerceArtist", () => {
  it("maps the form into a profile payload with numeric rates and style ids", () => {
    const out = coerceArtist(
      fd({
        slug: "sarah",
        name: "Sarah",
        status: "CO_OWNER",
        tag: "",
        bio: "Heritage tattooer",
        specials: "Snakes, Roses",
        hourlyRatePounds: "90",
        dayRatePounds: "600",
        insta: "@sarah",
        headshot: "",
        hue: "",
        booksStatus: "open",
        sortOrder: "2",
        active: "on",
        styleIds: ["s1", "s2"],
      }),
    );
    expect(out.profile).toMatchObject({
      slug: "sarah",
      name: "Sarah",
      status: "CO_OWNER",
      tag: null,
      bio: "Heritage tattooer",
      specials: ["Snakes", "Roses"],
      hourlyRatePence: 9000,
      dayRatePence: 60000,
      insta: "@sarah",
      headshot: null,
      hue: null,
      booksStatus: "open",
      sortOrder: 2,
      active: true,
    });
    expect(out.styleIds).toEqual(["s1", "s2"]);
  });

  it("defaults status to RESIDENT and books to open; coerces invalid enums", () => {
    const out = coerceArtist(
      fd({ name: "Tom", status: "BOGUS", booksStatus: "weird" }),
    );
    expect(out.profile.status).toBe("RESIDENT");
    expect(out.profile.booksStatus).toBe("open");
  });

  it("nulls blank rates and empty style selection", () => {
    const out = coerceArtist(
      fd({ name: "Jo", hourlyRatePounds: "", dayRatePounds: "" }),
    );
    expect(out.profile.hourlyRatePence).toBeNull();
    expect(out.profile.dayRatePence).toBeNull();
    expect(out.styleIds).toEqual([]);
  });

  it("reads the access role + email for unified create", () => {
    const out = coerceArtist(
      fd({ name: "Cal", email: "cal@bootsnbandit.co.uk", accessRole: "OWNER" }),
    );
    expect(out.email).toBe("cal@bootsnbandit.co.uk");
    expect(out.accessRole).toBe("OWNER");
  });

  it("defaults access role to ARTIST when unknown", () => {
    const out = coerceArtist(fd({ name: "X", accessRole: "nope" }));
    expect(out.accessRole).toBe("ARTIST");
  });
});
