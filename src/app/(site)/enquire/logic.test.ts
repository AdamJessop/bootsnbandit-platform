import { describe, expect, it } from "vitest";
import {
  AVAILABILITY,
  buildConsultMonth,
  buildEnquiryPayload,
  canAdvance,
  CONSULT_TIMES,
  emptyWizardState,
  isContactValid,
  isWorkingDay,
  MAX_STYLES,
  toggleStyle,
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
  });
});
