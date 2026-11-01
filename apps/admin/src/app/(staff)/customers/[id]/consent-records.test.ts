import { describe, expect, it } from "vitest";
import {
  CURRENT_CONSENT_FORM,
  consentFormFor,
  consentSnapshot,
} from "@bnb/core/consent";
import {
  buildConsentRecords,
  canViewConsent,
  type ConsentBookingRow,
  type ConsentFormRow,
} from "./consent-records";

const V2 = consentFormFor(2);

/** A v2 form (the kiosk form before the paper form was adopted). */
function form(over: Partial<ConsentFormRow> = {}): ConsentFormRow {
  return {
    id: "f1",
    signedAt: new Date("2026-11-01T10:00:00.000Z"),
    flagged: false,
    answers: Object.fromEntries(
      V2.questions.map((q) => [q.id, q.expect === "yes"]),
    ),
    signature: "data:image/png;base64,AA",
    formVersion: 2,
    questions: V2.questions,
    printedName: "Megan Wray",
    dob: new Date(Date.UTC(1990, 0, 15)),
    medicalNotes: null,
    photoConsent: true,
    idCheckedBy: "Sarah",
    idCheckedAt: new Date("2026-11-01T10:01:00.000Z"),
    ...over,
  };
}

function booking(over: Partial<ConsentBookingRow> = {}): ConsentBookingRow {
  return {
    id: "b1",
    artistId: "art-sarah",
    start: new Date("2026-11-01T10:30:00.000Z"),
    type: "session",
    artist: { name: "Sarah" },
    consentForm: form(),
    ...over,
  };
}

const OWNER = { role: "OWNER" as const, artistId: null };

describe("buildConsentRecords", () => {
  it("reads back the snapshot: version, name, DOB, ID checker, signature", () => {
    const [r] = buildConsentRecords([booking()], OWNER);
    expect(r).toMatchObject({
      id: "f1",
      bookingId: "b1",
      version: 2,
      printedName: "Megan Wray",
      dob: "1990-01-15",
      idCheckedBy: "Sarah",
      photoConsent: true,
      artistName: "Sarah",
      signature: "data:image/png;base64,AA",
      lightInkSignature: false,
    });
    expect(r.answers).toHaveLength(V2.questions.length);
    expect(r.answers.every((a) => !a.flagged)).toBe(true);
  });

  it("reads back a v3 paper form: both halves, the statements, both signatures", () => {
    const v3 = CURRENT_CONSENT_FORM;
    const [r] = buildConsentRecords(
      [
        booking({
          consentForm: form({
            formVersion: 3,
            questions: JSON.parse(JSON.stringify(consentSnapshot(v3, true))),
            answers: Object.fromEntries(
              v3.questions.map((q) => [q.id, q.id === "allergies"]),
            ),
            flagged: true,
            medicalNotes: "Nickel allergy",
            photoConsent: null,
            idCheckedBy: null,
            idCheckedAt: null,
            address: "1 Bridge Street, Worksop",
            postcode: "S80 1LX",
            phone: "07700 900123",
            email: "megan@example.com",
            idProvided: "Driving licence",
            designPlacement: "Rose · forearm",
            artistName: "Cal",
            artistSignature: "data:image/png;base64,ART",
            artistSignedAt: new Date("2026-11-01T10:05:00.000Z"),
          }),
        }),
      ],
      OWNER,
    );
    expect(r).toMatchObject({
      version: 3,
      paperForm: true,
      address: "1 Bridge Street, Worksop",
      postcode: "S80 1LX",
      phone: "07700 900123",
      email: "megan@example.com",
      idProvided: "Driving licence",
      designPlacement: "Rose · forearm",
      studioName: "Boots 'n' Bandit",
      signingArtist: "Cal",
      artistSignature: "data:image/png;base64,ART",
      artistSignedAt: "2026-11-01T10:05:00.000Z",
      medicalNotes: "Nickel allergy",
      agreed: true,
      agreeLabel: "I have read and agree to all of the above",
    });
    expect(r.answers).toHaveLength(12);
    expect(r.answers.filter((a) => a.flagged)).toEqual([
      {
        id: "allergies",
        q: "Allergies especially nickel allergy",
        explanation:
          "may result in serious skin reactions present on products used. I.e ink, jewellery",
        answer: "Yes",
        flagged: true,
      },
    ]);
    expect(r.statements).toEqual(v3.statements);
    expect(r.clientInformation).toEqual(v3.clientInformation);
  });

  it("v2 forms have no paper-form fields, statements or artist signature", () => {
    const [r] = buildConsentRecords([booking()], OWNER);
    expect(r).toMatchObject({
      paperForm: false,
      address: null,
      idProvided: null,
      signingArtist: null,
      artistSignature: null,
      statements: [],
      clientInformation: null,
      agreed: null,
    });
  });

  it("canViewConsent: owners always, artists only on their own bookings", () => {
    expect(canViewConsent({ artistId: "x" }, OWNER)).toBe(true);
    expect(
      canViewConsent({ artistId: "x" }, { role: "ARTIST", artistId: "x" }),
    ).toBe(true);
    expect(
      canViewConsent({ artistId: "x" }, { role: "ARTIST", artistId: "y" }),
    ).toBe(false);
  });

  it("highlights the flagged answers", () => {
    const answers = {
      ...(form().answers as Record<string, boolean>),
      diabetes: true,
    };
    const [r] = buildConsentRecords(
      [booking({ consentForm: form({ answers, flagged: true }) })],
      OWNER,
    );
    const flagged = r.answers.filter((a) => a.flagged);
    expect(flagged.map((a) => a.id)).toEqual(["diabetes"]);
    expect(flagged[0]).toMatchObject({
      q: "Do you have diabetes?",
      answer: "Yes",
    });
  });

  it("uses the question text stored on the form, not today's wording", () => {
    const [r] = buildConsentRecords(
      [
        booking({
          consentForm: form({
            questions: [
              { id: "age", q: "Old wording", expect: "yes", section: "today" },
            ],
            answers: { age: true },
          }),
        }),
      ],
      OWNER,
    );
    expect(r.answers).toEqual([
      {
        id: "age",
        q: "Old wording",
        explanation: null,
        answer: "Yes",
        flagged: false,
      },
    ]);
  });

  it("reads pre-snapshot forms against v1 (and flags v1 skin/pregnancy No)", () => {
    const [r] = buildConsentRecords(
      [
        booking({
          consentForm: form({
            formVersion: null,
            questions: null,
            printedName: null,
            dob: null,
            idCheckedBy: null,
            idCheckedAt: null,
            answers: { age: true, skin: false, preg: false },
          }),
        }),
      ],
      OWNER,
    );
    expect(r.version).toBe(1);
    expect(r.lightInkSignature).toBe(true);
    expect(r.answers.filter((a) => a.flagged).map((a) => a.id)).toEqual([
      "skin",
      "preg",
    ]);
    // Unanswered v1 questions read as a dash, not a flag.
    expect(r.answers.find((a) => a.id === "eaten")).toMatchObject({
      answer: "—",
      flagged: false,
    });
  });

  it("an owner sees every form; an artist only forms from their own bookings", () => {
    const rows = [
      booking(),
      booking({
        id: "b2",
        artistId: "art-cal",
        artist: { name: "Cal" },
        consentForm: form({ id: "f2" }),
      }),
      booking({ id: "b3", consentForm: null }),
    ];
    expect(
      buildConsentRecords(rows, OWNER)
        .map((r) => r.id)
        .sort(),
    ).toEqual(["f1", "f2"]);
    expect(
      buildConsentRecords(rows, { role: "ARTIST", artistId: "art-cal" }).map(
        (r) => r.id,
      ),
    ).toEqual(["f2"]);
    expect(
      buildConsentRecords(rows, { role: "ARTIST", artistId: null }),
    ).toEqual([]);
  });

  it("lists the newest form first", () => {
    const rows = [
      booking(),
      booking({
        id: "b2",
        consentForm: form({
          id: "f2",
          signedAt: new Date("2026-11-02T10:00:00.000Z"),
        }),
      }),
    ];
    expect(buildConsentRecords(rows, OWNER).map((r) => r.id)).toEqual([
      "f2",
      "f1",
    ]);
  });
});
