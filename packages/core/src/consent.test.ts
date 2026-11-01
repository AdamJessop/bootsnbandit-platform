import { describe, expect, it } from "vitest";
import {
  CONSENT_FORMS,
  CONSENT_SECTIONS,
  CURRENT_CONSENT_FORM,
  CURRENT_CONSENT_VERSION,
  ID_TYPES,
  ageOn,
  allAnswered,
  consentDetailsErrors,
  consentFormFor,
  consentSnapshot,
  flaggedQuestions,
  furtherDetailsRequired,
  idProvidedText,
  isFlaggedAnswer,
  isFormFlagged,
  normalisePostcode,
  readConsentSnapshot,
} from "./consent";

/** Every question answered the way that needs no follow-up. */
function clean(version = CURRENT_CONSENT_VERSION): Record<string, boolean> {
  return Object.fromEntries(
    consentFormFor(version).questions.map((q) => [q.id, q.expect === "yes"]),
  );
}

describe("consent question set", () => {
  it("is on v3 and keeps v1 and v2 so older forms still read back", () => {
    expect(CURRENT_CONSENT_VERSION).toBe(3);
    expect(Object.keys(CONSENT_FORMS).map(Number)).toEqual([1, 2, 3]);
    expect(consentFormFor(null).version).toBe(1);
    expect(consentFormFor(undefined).version).toBe(1);
    expect(consentFormFor(2).version).toBe(2);
    expect(consentFormFor(3)).toBe(CURRENT_CONSENT_FORM);
  });

  it("v2 still asks the health questions it was signed with", () => {
    const ids = consentFormFor(2).questions.map((q) => q.id);
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
    expect(allAnswered({ skin: false })).toBe(false);
    expect(allAnswered(clean())).toBe(true);
    const missingOne = clean();
    delete missingOne.skin;
    expect(allAnswered(missingOne)).toBe(false);
  });
});

describe("v3 — the studio's paper Client Consent Form", () => {
  const v3 = consentFormFor(3);

  it("has the paper's twelve medical rows, in paper order, each expecting No", () => {
    expect(v3.questions.map((q) => q.q)).toEqual([
      "Eczema, Psoriasis, Acne, Cellulitis, or other skin condition",
      "Heart Disorders",
      "High/Low Blood Pressure",
      "Epilepsy or other form of seizures",
      "Diabetes",
      "Hepatitis",
      "Autoimmune Disease or treatment causing it e.g cancer treatment",
      "Allergies especially nickel allergy",
      "Pregnant",
      "Nursing mother",
      "Medication",
      "Any other condition not listed",
    ]);
    for (const q of v3.questions) {
      expect(q.expect).toBe("no");
      expect(q.section).toBe("medical");
      expect(q.explanation?.length).toBeGreaterThan(0);
    }
    const ids = v3.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fixes the paper's typo and points the details at the box, not the back", () => {
    const heart = v3.questions.find((q) => q.id === "heart");
    expect(heart?.explanation).toContain("more prone to serious heart");
    const text = JSON.stringify(v3);
    expect(text).not.toContain("prong");
    expect(text).not.toContain("back of your form");
    expect(v3.questions.at(-1)?.explanation).toBe(
      "please give further details below",
    );
    expect(v3.furtherDetailsPrompt).toBe(
      "If you answered yes to any of the above, please give further details",
    );
  });

  it("carries the client-information risks", () => {
    expect(v3.clientInformation?.intro).toBe(
      "Known (potential) risks associated with tattooing/piercing:",
    );
    expect(v3.clientInformation?.risks).toEqual([
      "Scarring",
      "Blood Poisoning (Septicaemia)",
      "Localised Infection",
      "Allergic reactions to pigment/jewellery",
      "Localised swelling around the area",
    ]);
  });

  it("has the eleven individual consent statements in paper order", () => {
    const statements = v3.statements ?? [];
    expect(statements.map((s) => s.id)).toEqual([
      "questions",
      "allergy",
      "inkRisk",
      "consent",
      "accurate",
      "waiver",
      "sober",
      "design",
      "skinTreatment",
      "notMedical",
      "disclosure",
    ]);
    expect(statements[0].text).toMatch(/^I acknowledge by signing/);
    // Age and alcohol/drugs are covered by the statements, not extra ticks.
    expect(statements[4].text).toContain("over 18 years of age");
    expect(statements[6].text).toContain("alcohol or drugs");
    expect(statements[5].text).toContain(
      "to the fullest extent permitted by law",
    );
    expect(v3.agreeLabel).toBe("I have read and agree to all of the above");
  });

  it("drops the v2 extras that are not on the paper", () => {
    const ids = v3.questions.map((q) => q.id);
    for (const gone of ["age", "eaten", "sober", "consent", "aftercare"]) {
      expect(ids).not.toContain(gone);
    }
  });

  it("any Yes flags the form and makes further details required", () => {
    expect(furtherDetailsRequired(clean())).toBe(false);
    for (const q of v3.questions) {
      const answers = { ...clean(), [q.id]: true };
      expect(furtherDetailsRequired(answers)).toBe(true);
      expect(isFormFlagged(answers, "1990-01-15")).toBe(true);
    }
  });
});

describe("consentDetailsErrors", () => {
  const on = new Date(2026, 10, 1);
  const good = {
    printedName: "Megan Wray",
    address: "1 Bridge Street, Worksop",
    postcode: "s80 1lx",
    phone: "07700 900123",
    email: "megan@example.com",
    dob: "1990-01-15",
  };

  it("accepts a complete set of details (email optional)", () => {
    expect(consentDetailsErrors(good, on)).toEqual({});
    expect(consentDetailsErrors({ ...good, email: "" }, on)).toEqual({});
  });

  it("names every missing field", () => {
    const errors = consentDetailsErrors(
      {
        printedName: " ",
        address: "",
        postcode: "",
        phone: "",
        email: "",
        dob: "",
      },
      on,
    );
    expect(Object.keys(errors).sort()).toEqual(
      ["address", "dob", "phone", "postcode", "printedName"].sort(),
    );
  });

  it("rejects a malformed email, postcode, phone or date of birth", () => {
    expect(consentDetailsErrors({ ...good, email: "megan@" }, on)).toEqual({
      email: "That doesn't look like an email address",
    });
    expect(consentDetailsErrors({ ...good, postcode: "12345" }, on)).toEqual({
      postcode: "That doesn't look like a UK postcode",
    });
    expect(consentDetailsErrors({ ...good, phone: "12345" }, on)).toEqual({
      phone: "That doesn't look like a phone number",
    });
    for (const dob of ["2027-01-01", "1890-01-01", "2008-02-30"]) {
      expect(consentDetailsErrors({ ...good, dob }, on)).toEqual({
        dob: "Check your date of birth",
      });
    }
  });

  it("an under-18 DOB is valid here — it flags, it doesn't block", () => {
    expect(consentDetailsErrors({ ...good, dob: "2012-05-01" }, on)).toEqual(
      {},
    );
  });
});

describe("normalisePostcode", () => {
  it("upper-cases and spaces a UK postcode", () => {
    expect(normalisePostcode("s801lx")).toBe("S80 1LX");
    expect(normalisePostcode("  SW1A  1aa ")).toBe("SW1A 1AA");
    expect(normalisePostcode("M1 1AE")).toBe("M1 1AE");
  });
  it("returns null for anything else", () => {
    expect(normalisePostcode("12345")).toBeNull();
    expect(normalisePostcode("")).toBeNull();
  });
});

describe("idProvidedText", () => {
  it("is the type's label, or Other with what it was", () => {
    expect(idProvidedText("passport")).toBe("Passport");
    expect(idProvidedText("driving_licence")).toBe("Driving licence");
    expect(idProvidedText("pass_card")).toBe("Citizen/PASS card");
    expect(idProvidedText("other", "  Military ID ")).toBe(
      "Other: Military ID",
    );
  });
  it("is null with no type, an unknown type or a blank Other", () => {
    expect(idProvidedText(null)).toBeNull();
    expect(idProvidedText("library_card")).toBeNull();
    expect(idProvidedText("other", "  ")).toBeNull();
  });
  it("offers exactly the four paper-form options", () => {
    expect(ID_TYPES.map((t) => t.label)).toEqual([
      "Passport",
      "Driving licence",
      "Citizen/PASS card",
      "Other",
    ]);
  });
});

describe("consent snapshot", () => {
  it("v3 stores the questions, risks, statements and the agreement", () => {
    const snap = consentSnapshot(CURRENT_CONSENT_FORM, true);
    expect(Array.isArray(snap)).toBe(false);
    const back = readConsentSnapshot(
      JSON.parse(JSON.stringify(snap)),
      CURRENT_CONSENT_VERSION,
    );
    expect(back.questions).toEqual(CURRENT_CONSENT_FORM.questions);
    expect(back.statements).toEqual(CURRENT_CONSENT_FORM.statements);
    expect(back.clientInformation).toEqual(
      CURRENT_CONSENT_FORM.clientInformation,
    );
    expect(back.agreed).toBe(true);
  });

  it("the stored text wins over today's definition", () => {
    const snap = consentSnapshot(CURRENT_CONSENT_FORM, true) as {
      statements: { id: string; text: string }[];
    };
    snap.statements[0] = { id: "questions", text: "As it read then." };
    const back = readConsentSnapshot(snap, 3);
    expect(back.statements[0].text).toBe("As it read then.");
  });

  it("v1/v2 forms stored a bare question array and had no agreement step", () => {
    const v2 = consentFormFor(2);
    expect(consentSnapshot(v2, false)).toEqual(
      v2.questions.map((q) => ({ ...q })),
    );
    const back = readConsentSnapshot(v2.questions, 2);
    expect(back.questions).toEqual(v2.questions);
    expect(back.statements).toEqual([]);
    expect(back.clientInformation).toBeNull();
    expect(back.agreed).toBeNull();
  });

  it("falls back to the version's set when nothing was stored", () => {
    expect(readConsentSnapshot(null, null).questions).toEqual(
      consentFormFor(1).questions,
    );
    expect(readConsentSnapshot(null, 3).statements).toHaveLength(11);
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
