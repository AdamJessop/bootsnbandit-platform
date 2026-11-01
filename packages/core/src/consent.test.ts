import { describe, expect, it } from "vitest";
import {
  CONSENT_FORMS,
  CONSENT_SECTIONS,
  CURRENT_CONSENT_FORM,
  CURRENT_CONSENT_VERSION,
  ageOn,
  allAnswered,
  consentFormFor,
  flaggedQuestions,
  isFlaggedAnswer,
  isFormFlagged,
} from "./consent";

/** Every question answered the way that needs no follow-up. */
function clean(version = CURRENT_CONSENT_VERSION): Record<string, boolean> {
  return Object.fromEntries(
    consentFormFor(version).questions.map((q) => [q.id, q.expect === "yes"]),
  );
}

describe("consent question set", () => {
  it("is on v2 and keeps v1 so older forms still read back", () => {
    expect(CURRENT_CONSENT_VERSION).toBe(2);
    expect(Object.keys(CONSENT_FORMS).map(Number)).toEqual([1, 2]);
    expect(consentFormFor(null).version).toBe(1);
    expect(consentFormFor(undefined).version).toBe(1);
    expect(consentFormFor(2)).toBe(CURRENT_CONSENT_FORM);
  });

  it("asks the health questions a UK studio needs", () => {
    const ids = CURRENT_CONSENT_FORM.questions.map((q) => q.id);
    for (const id of [
      "age",
      "sober",
      "skin",
      "preg",
      "bloodThinners",
      "diabetes",
      "epilepsy",
      "heart",
      "bloodBorne",
      "keloid",
      "allergies",
      "medical",
      "consent",
      "aftercare",
    ]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts every question in a known section", () => {
    const sections = CONSENT_SECTIONS.map((s) => s.id);
    for (const form of Object.values(CONSENT_FORMS)) {
      for (const q of form.questions) expect(sections).toContain(q.section);
    }
  });

  it("a fully clean form raises no flags", () => {
    expect(flaggedQuestions(clean())).toEqual([]);
    expect(flaggedQuestions(clean(1), consentFormFor(1).questions)).toEqual([]);
  });

  // Each question on its own: the unexpected answer flags exactly that one
  // question, and the expected answer flags nothing.
  for (const form of Object.values(CONSENT_FORMS)) {
    for (const q of form.questions) {
      it(`v${form.version} "${q.id}" flags only the concerning answer`, () => {
        const expected = q.expect === "yes";
        const concerning = { ...clean(form.version), [q.id]: !expected };
        expect(
          flaggedQuestions(concerning, form.questions).map((f) => f.id),
        ).toEqual([q.id]);
        expect(isFlaggedAnswer(q, expected)).toBe(false);
        expect(isFlaggedAnswer(q, !expected)).toBe(true);
      });
    }
  }

  it("the v1 skin, pregnancy and medical answers now flag on No", () => {
    const v1 = consentFormFor(1).questions;
    const flags = flaggedQuestions(
      { ...clean(1), skin: false, preg: false, medical: false },
      v1,
    );
    expect(flags.map((q) => q.id)).toEqual(["skin", "preg", "medical"]);
  });

  it("an unanswered question is not a flag", () => {
    expect(flaggedQuestions({})).toEqual([]);
  });

  it("allAnswered requires a boolean for every question", () => {
    expect(allAnswered({ age: true })).toBe(false);
    expect(allAnswered(clean())).toBe(true);
    const missingOne = clean();
    delete missingOne.age;
    expect(allAnswered(missingOne)).toBe(false);
  });
});

describe("isFormFlagged", () => {
  const on = new Date(2026, 10, 1);

  it("is clean for clean answers from an adult", () => {
    expect(isFormFlagged(clean(), "1990-01-15", on)).toBe(false);
  });

  it("flags any concerning answer", () => {
    expect(
      isFormFlagged({ ...clean(), diabetes: true }, "1990-01-15", on),
    ).toBe(true);
  });

  it("flags a date of birth under 18 even with clean answers", () => {
    expect(isFormFlagged(clean(), "2008-11-02", on)).toBe(true);
    expect(isFormFlagged(clean(), "2008-11-01", on)).toBe(false);
  });
});

describe("ageOn", () => {
  const on = new Date(2026, 10, 1); // 1 Nov 2026

  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("2008-11-01", on)).toBe(18);
    expect(ageOn("2008-11-02", on)).toBe(17);
    expect(ageOn("1990-01-15", on)).toBe(36);
  });

  it("rejects malformed, impossible and future dates", () => {
    expect(ageOn("01/11/2008", on)).toBeNull();
    expect(ageOn("2008-02-30", on)).toBeNull();
    expect(ageOn("2027-01-01", on)).toBeNull();
  });
});
