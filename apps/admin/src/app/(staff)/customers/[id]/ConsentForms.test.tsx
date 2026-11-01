import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CURRENT_CONSENT_FORM } from "@bnb/core/consent";
import { ConsentForms, consentPrintHref } from "./ConsentForms";
import type { ConsentRecord } from "./consent-records";

/** A v2 form — the kiosk form before the paper form was adopted. */
const record: ConsentRecord = {
  id: "f1",
  bookingId: "b1",
  signedAt: "2026-11-01T10:00:00.000Z",
  bookingStart: "2026-11-01T10:30:00.000Z",
  bookingType: "session",
  artistName: "Sarah",
  version: 2,
  flagged: true,
  printedName: "Megan Wray",
  dob: "1990-01-15",
  medicalNotes: "Inhaler in bag",
  photoConsent: false,
  idCheckedBy: "Sarah",
  idCheckedAt: "2026-11-01T10:01:00.000Z",
  signature: "data:image/png;base64,SIG",
  lightInkSignature: false,
  answers: [
    {
      id: "age",
      q: "I am 18 or over.",
      explanation: null,
      answer: "Yes",
      flagged: false,
    },
    {
      id: "diabetes",
      q: "Do you have diabetes?",
      explanation: null,
      answer: "Yes",
      flagged: true,
    },
  ],
  paperForm: false,
  address: null,
  postcode: null,
  phone: null,
  email: null,
  idProvided: null,
  designPlacement: null,
  studioName: "Boots 'n' Bandit",
  signingArtist: null,
  artistSignature: null,
  artistSignedAt: null,
  furtherDetailsPrompt: "",
  clientInformation: null,
  statements: [],
  agreeLabel: "",
  agreed: null,
};

/** A v3 form — the studio's paper Client Consent Form. */
const paper: ConsentRecord = {
  ...record,
  id: "f3",
  version: 3,
  medicalNotes: "Nickel allergy — no cheap jewellery",
  photoConsent: null,
  idCheckedBy: null,
  idCheckedAt: null,
  answers: [
    {
      id: "allergies",
      q: "Allergies especially nickel allergy",
      explanation: "may result in serious skin reactions",
      answer: "Yes",
      flagged: true,
    },
    {
      id: "heart",
      q: "Heart Disorders",
      explanation: "more prone to serious heart complications",
      answer: "No",
      flagged: false,
    },
  ],
  paperForm: true,
  address: "1 Bridge Street, Worksop",
  postcode: "S80 1LX",
  phone: "07700 900123",
  email: "megan@example.com",
  idProvided: "Driving licence",
  designPlacement: "Rose · forearm",
  signingArtist: "Cal",
  artistSignature: "data:image/png;base64,ARTSIG",
  artistSignedAt: "2026-11-01T10:05:00.000Z",
  furtherDetailsPrompt: CURRENT_CONSENT_FORM.furtherDetailsPrompt!,
  clientInformation: CURRENT_CONSENT_FORM.clientInformation!,
  statements: [...CURRENT_CONSENT_FORM.statements!],
  agreeLabel: CURRENT_CONSENT_FORM.agreeLabel!,
  agreed: true,
};

const render = (records: ConsentRecord[]) =>
  renderToStaticMarkup(<ConsentForms records={records} customerId="c1" />);

describe("ConsentForms", () => {
  it("shows date, version, DOB, ID checker, answers, notes and the signature", () => {
    const html = render([record]);
    expect(html).toContain("Signed 01 Nov 2026");
    expect(html).toContain("form v2");
    expect(html).toContain("Session with");
    expect(html).toContain("Megan Wray");
    expect(html).toContain("15 Jan 1990");
    expect(html).toContain("ID checked by: ");
    expect(html).toContain("Sarah · 01 Nov 2026");
    expect(html).toContain("No photos");
    expect(html).toContain("Anything else: ");
    expect(html).toContain("Inhaler in bag");
    expect(html).toContain('src="data:image/png;base64,SIG"');
    expect(html).toContain("bg-white");
    expect(html).toContain("Flagged");
    expect(html).not.toContain("Artist signature");
  });

  it("highlights only the flagged answers", () => {
    const html = render([record]);
    expect(html.match(/data-flagged="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /data-flagged="true"[^>]*>[\s\S]*Do you have diabetes\?/,
    );
  });

  it("gives old light-ink signatures a dark backing", () => {
    const html = render([{ ...record, lightInkSignature: true }]);
    expect(html).toContain("bg-bg-base");
    expect(html).not.toContain("bg-white");
  });

  it("has a plain empty state and no edit controls", () => {
    expect(render([])).toContain("No consent forms signed on the kiosk yet.");
    const html = render([record, paper]);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });

  it("links every form to its print view", () => {
    expect(consentPrintHref("c1", "f3")).toBe("/customers/c1/consent/f3/print");
    const html = render([record, paper]);
    expect(html).toContain('href="/customers/c1/consent/f1/print"');
    expect(html).toContain('href="/customers/c1/consent/f3/print"');
  });
});

describe("ConsentForms — v3 paper form", () => {
  const html = render([paper]);

  it("shows both halves of the header table", () => {
    for (const [label, value] of [
      ["Client name", "Megan Wray"],
      ["Date of birth", "15 Jan 1990"],
      ["Address", "1 Bridge Street, Worksop"],
      ["Postcode", "S80 1LX"],
      ["Telephone", "07700 900123"],
      ["Email", "megan@example.com"],
      ["ID provided", "Driving licence"],
      ["Design/placement", "Rose · forearm"],
      ["Tattoo studio", "Boots &#x27;n&#x27; Bandit"],
      ["Artist", "Cal"],
    ]) {
      expect(html).toContain(`${label}: </dt>`);
      expect(html).toContain(value);
    }
    expect(html).not.toContain("Portfolio photos");
  });

  it("shows each condition with its explanation, and the further details", () => {
    expect(html).toContain("Allergies especially nickel allergy");
    expect(html).toContain("may result in serious skin reactions");
    expect(html).toContain("Further details: ");
    expect(html).toContain("Nickel allergy — no cheap jewellery");
    expect(html.match(/data-flagged="true"/g)).toHaveLength(1);
  });

  it("keeps the risks and the statements agreed with the form", () => {
    expect(html).toContain("Client information and consent statements");
    expect(html).toContain(" · agreed");
    expect(html).toContain("Blood Poisoning (Septicaemia)");
    for (const s of paper.statements) expect(html).toContain(s.text);
    expect(html).toContain("✓ I have read and agree to all of the above");
  });

  it("shows both signatures with their dates", () => {
    expect(html).toContain("Client signature");
    expect(html).toContain('src="data:image/png;base64,SIG"');
    expect(html).toContain("Artist signature");
    expect(html).toContain('src="data:image/png;base64,ARTSIG"');
    expect(html).toContain('alt="Signature of Cal"');
    expect(html.match(/Date: 01 Nov 2026/g)).toHaveLength(2);
  });
});
