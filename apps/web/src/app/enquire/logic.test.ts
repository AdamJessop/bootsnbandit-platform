import { describe, expect, it } from "vitest";
import {
  addMoodboardRef,
  AVAILABILITY,
  buildConsultMonth,
  buildEnquiryPayload,
  canAdvance,
  CONSULT_TIMES,
  emptyWizardState,
  isContactValid,
  isWorkingDay,
  MAX_MOODBOARD_REFS,
  MAX_STYLES,
  moodboardRefLabel,
  parseBudgetPounds,
  resolveSeedArtist,
  toggleStyle,
  waitlistNote,
  type WizardState,
} from "./logic";

describe("enquire logic — working days & consult month", () => {
  it("treats Tue–Sat as working days, Sun/Mon as closed", () => {
    // 2026-06-15 is a Monday.
    expect(isWorkingDay(new Date(2026, 5, 14))).toBe(false); // Sun
    expect(isWorkingDay(new Date(2026, 5, 15))).toBe(false); // Mon
    expect(isWorkingDay(new Date(2026, 5, 16))).toBe(true); // Tue
    expect(isWorkingDay(new Date(2026, 5, 20))).toBe(true); // Sat
  });

  it("exposes 7 consult times", () => {
    expect(CONSULT_TIMES).toHaveLength(7);
    expect(CONSULT_TIMES[0]).toBe("10:00");
  });

  it("marks past and non-working days full, future working days bookable", () => {
    const today = new Date(2026, 5, 19); // Fri 19 Jun 2026
    const month = buildConsultMonth(2026, 5, today);
    const d10 = month.find((d) => d.day === 10)!; // past
    const d15 = month.find((d) => d.day === 15)!; // Mon (closed)
    const d23 = month.find((d) => d.day === 23)!; // Tue (future, working)
    expect(d10.status).toBe("full");
    expect(d15.status).toBe("full");
    expect(d23.status).not.toBe("full");
  });
});

describe("enquire logic — style selection", () => {
  it("adds and removes styles", () => {
    expect(toggleStyle([], "Fine-line")).toEqual(["Fine-line"]);
    expect(toggleStyle(["Fine-line"], "Fine-line")).toEqual([]);
  });

  it("caps at MAX_STYLES", () => {
    const full = ["A", "B", "C"];
    expect(full).toHaveLength(MAX_STYLES);
    expect(toggleStyle(full, "D")).toEqual(full);
  });
});

describe("enquire logic — step gating", () => {
  it("always allows the Artist step (match-me is valid)", () => {
    expect(canAdvance("Artist", emptyWizardState())).toBe(true);
  });

  it("requires an idea on the Idea step", () => {
    const s = emptyWizardState();
    expect(canAdvance("Idea", s)).toBe(false);
    s.subject = "a koi";
    expect(canAdvance("Idea", s)).toBe(true);
  });

  it("does not require an idea on the Idea step for a flash claim", () => {
    const s = emptyWizardState();
    expect(canAdvance("Idea", s, { flash: true })).toBe(true);
    expect(canAdvance("Idea", s, { flash: false })).toBe(false);
  });

  it("requires general availability on the Consultation step", () => {
    const s = emptyWizardState();
    expect(canAdvance("Consultation", s)).toBe(false);
    s.availability = AVAILABILITY[0];
    expect(canAdvance("Consultation", s)).toBe(true);
  });

  it("requires a name + a contact method on Details", () => {
    const s = emptyWizardState();
    expect(isContactValid(s)).toBe(false);
    s.name = "Ada";
    expect(isContactValid(s)).toBe(false);
    s.email = "ada@example.com";
    expect(isContactValid(s)).toBe(true);
    s.email = "";
    s.phone = "07123456789";
    expect(isContactValid(s)).toBe(true);
  });
});

describe("enquire logic — payload", () => {
  it("builds a web-source enquiry payload folding consult prefs into the description", () => {
    const s: WizardState = {
      ...emptyWizardState(),
      artistId: "sarah",
      styles: ["Fine-line", "Colour"],
      subject: "floral wrap",
      placement: "Forearm",
      size: "Medium",
      moodboard: ["data:img1"],
      availability: "Weekends only",
      days: ["Sat", "Sun"],
      consultDate: "2026-06-23",
      consultTime: "14:00",
      name: "Ada Lovelace",
      email: "ada@example.com",
      notes: "first tattoo",
    };
    const p = buildEnquiryPayload(s);
    expect(p.source).toBe("web");
    expect(p.preferredArtistId).toBe("sarah");
    expect(p.style).toBe("Fine-line, Colour");
    expect(p.placement).toBe("Forearm");
    expect(p.size).toBe("Medium");
    expect(p.contactEmail).toBe("ada@example.com");
    expect(p.contactPhone).toBeNull();
    expect(p.moodboard).toEqual(["data:img1"]);
    expect(p.description).toContain("floral wrap");
    expect(p.description).toContain("Weekends only");
    expect(p.description).toContain("2026-06-23 at 14:00");
    expect(p.description).toContain("first tattoo");
  });

  it("nulls empty optional fields and supports match-me", () => {
    const s = { ...emptyWizardState(), name: "Sam", phone: "07123456789" };
    const p = buildEnquiryPayload(s);
    expect(p.preferredArtistId).toBeNull();
    expect(p.style).toBeNull();
    expect(p.placement).toBeNull();
    expect(p.size).toBeNull();
    expect(p.contactPhone).toBe("07123456789");
    expect(p.budgetPence).toBeNull();
  });

  it("maps the £ budget input to budgetPence", () => {
    const s = {
      ...emptyWizardState(),
      name: "Sam",
      phone: "07123456789",
      budget: "150",
    };
    expect(buildEnquiryPayload(s).budgetPence).toBe(15000);
  });
});

describe("enquire logic — budget parsing", () => {
  it("parses plain pounds, £-prefixed and decimal amounts", () => {
    expect(parseBudgetPounds("150")).toBe(15000);
    expect(parseBudgetPounds("£150")).toBe(15000);
    expect(parseBudgetPounds(" 99.50 ")).toBe(9950);
    expect(parseBudgetPounds("1,200")).toBe(120000);
  });

  it("returns null for empty, negative or nonsense input", () => {
    expect(parseBudgetPounds("")).toBeNull();
    expect(parseBudgetPounds("   ")).toBeNull();
    expect(parseBudgetPounds("-40")).toBeNull();
    expect(parseBudgetPounds("about £200")).toBeNull();
  });
});

describe("enquire logic — seed artist resolution", () => {
  const artists = [
    { id: "cku123", slug: "sarah", name: "Sarah", booksStatus: "open" },
    { id: "cku456", slug: "calum", name: "Calum", booksStatus: "closed" },
  ];

  it("resolves the ?artist= param by DB id", () => {
    expect(resolveSeedArtist(artists, "cku123")?.slug).toBe("sarah");
  });

  it("resolves the ?artist= param by slug (artist-detail links)", () => {
    expect(resolveSeedArtist(artists, "calum")?.id).toBe("cku456");
  });

  it("returns null for unknown or missing params", () => {
    expect(resolveSeedArtist(artists, "nobody")).toBeNull();
    expect(resolveSeedArtist(artists, undefined)).toBeNull();
    expect(resolveSeedArtist(artists, "")).toBeNull();
  });
});

describe("enquire logic — waitlist note", () => {
  it("returns a note for closed-books artists", () => {
    const note = waitlistNote({ name: "Calum Rhodes", booksStatus: "closed" });
    expect(note).toContain("Calum");
    expect(note).toContain("waitlist");
  });

  it("returns null for open/limited books or no artist", () => {
    expect(waitlistNote({ name: "Sarah", booksStatus: "open" })).toBeNull();
    expect(waitlistNote({ name: "Amy", booksStatus: "limited" })).toBeNull();
    expect(waitlistNote(null)).toBeNull();
    expect(waitlistNote(undefined)).toBeNull();
  });
});

describe("enquire logic — mood-board references", () => {
  it("accepts a valid http(s) URL, trimming whitespace", () => {
    const res = addMoodboardRef([], "  https://example.com/ink.jpg  ");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.refs).toEqual(["https://example.com/ink.jpg"]);
  });

  it("rejects non-URLs and non-http(s) schemes", () => {
    expect(addMoodboardRef([], "not a url").ok).toBe(false);
    expect(addMoodboardRef([], "ftp://example.com/x.jpg").ok).toBe(false);
    expect(addMoodboardRef([], "javascript:alert(1)").ok).toBe(false);
    expect(addMoodboardRef([], "").ok).toBe(false);
  });

  it("dedupes previously added references", () => {
    const first = addMoodboardRef([], "https://example.com/a.jpg");
    if (!first.ok) throw new Error("expected ok");
    const dup = addMoodboardRef(first.refs, "https://example.com/a.jpg");
    expect(dup.ok).toBe(false);
  });

  it(`caps the board at ${MAX_MOODBOARD_REFS} references`, () => {
    const refs = Array.from(
      { length: MAX_MOODBOARD_REFS },
      (_, i) => `https://example.com/${i}.jpg`,
    );
    const res = addMoodboardRef(refs, "https://example.com/extra.jpg");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(String(MAX_MOODBOARD_REFS));
  });

  it("labels references by host + path, truncated", () => {
    expect(moodboardRefLabel("https://example.com/a.jpg")).toBe(
      "example.com/a.jpg",
    );
    const long = `https://example.com/${"x".repeat(80)}.jpg`;
    expect(moodboardRefLabel(long).length).toBeLessThanOrEqual(40);
  });
});
