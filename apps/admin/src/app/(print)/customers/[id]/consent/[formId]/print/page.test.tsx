import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CURRENT_CONSENT_FORM,
  consentFormFor,
  consentSnapshot,
} from "@bnb/core/consent";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));

const findFirst = vi.fn();
vi.mock("@bnb/core/db", () => ({
  prisma: { booking: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

const { requireRole } = await import("@bnb/core/auth");
const { notFound } = await import("next/navigation");
const { default: Page } = await import("./page");

const OWNER = {
  id: "u1",
  email: "o@x",
  role: "OWNER",
  displayName: "Owner",
} as never;
const artistUser = (artistId: string) =>
  ({
    id: "u2",
    email: "a@x",
    role: "ARTIST",
    displayName: "Artist",
    artistId,
  }) as never;

const V3 = CURRENT_CONSENT_FORM;
const V2 = consentFormFor(2);

/** A booking with a signed v3 (paper) form on Cal's chair. */
function v3Booking() {
  return {
    id: "b1",
    artistId: "art-cal",
    start: new Date("2026-11-01T10:30:00.000Z"),
    type: "session",
    artist: { name: "Cal" },
    consentForm: {
      id: "f3",
      signedAt: new Date("2026-11-01T10:00:00.000Z"),
      flagged: true,
      answers: Object.fromEntries(
        V3.questions.map((q) => [q.id, q.id === "medication"]),
      ),
      signature: "data:image/png;base64,CLIENTSIG",
      formVersion: 3,
      questions: JSON.parse(JSON.stringify(consentSnapshot(V3, true))),
      printedName: "Megan Wray",
      dob: new Date(Date.UTC(1990, 0, 15)),
      medicalNotes: "Sertraline 50mg",
      photoConsent: null,
      idCheckedBy: null,
      idCheckedAt: null,
      address: "1 Bridge Street\nWorksop",
      postcode: "S80 1LX",
      phone: "07700 900123",
      email: "megan@example.com",
      idProvided: "Passport",
      designPlacement: "Swallow · left forearm",
      artistName: "Calum",
      artistSignature: "data:image/png;base64,ARTISTSIG",
      artistSignedAt: new Date("2026-11-01T10:06:00.000Z"),
    },
  };
}

/** The same booking, signed on the old v2 kiosk form. */
function v2Booking() {
  const b = v3Booking();
  return {
    ...b,
    consentForm: {
      ...b.consentForm,
      id: "f2",
      formVersion: 2,
      questions: V2.questions,
      answers: Object.fromEntries(
        V2.questions.map((q) => [q.id, q.expect === "yes"]),
      ),
      flagged: false,
      medicalNotes: null,
      address: null,
      postcode: null,
      phone: null,
      email: null,
      idProvided: null,
      designPlacement: null,
      artistName: null,
      artistSignature: null,
      artistSignedAt: null,
      idCheckedBy: "Sarah",
      idCheckedAt: new Date("2026-11-01T10:01:00.000Z"),
    },
  };
}

async function render(formId = "f3") {
  return renderToStaticMarkup(
    await Page({ params: Promise.resolve({ id: "c1", formId }) }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(OWNER);
  findFirst.mockResolvedValue(v3Booking());
});

describe("consent print page — access", () => {
  it("looks the form up on this customer only", async () => {
    await render("f3");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: "c1", consentForm: { is: { id: "f3" } } },
      }),
    );
  });

  it("lets the owner and the booking's artist print it", async () => {
    expect(await render()).toContain("CLIENT CONSENT FORM");
    vi.mocked(requireRole).mockResolvedValue(artistUser("art-cal"));
    expect(await render()).toContain("CLIENT CONSENT FORM");
  });

  it("is a 404 for another artist, or a form not on this customer", async () => {
    vi.mocked(requireRole).mockResolvedValue(artistUser("art-sarah"));
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    vi.mocked(requireRole).mockResolvedValue(OWNER);
    findFirst.mockResolvedValue(null);
    await expect(render("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);
  });
});

describe("consent print page — v3 paper layout", () => {
  it("has the print button and A4 black-on-white print CSS", async () => {
    const html = await render();
    expect(html).toContain("Print / Save as PDF");
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain(".no-print { display: none !important; }");
    expect(html).toContain('class="cp-bar no-print"');
    expect(html).toContain('href="/customers/c1"');
  });

  it("reproduces the header table: client fields left, artist fields right", async () => {
    const html = await render();
    const rows = [
      ["Client Name:", "Megan Wray", "D.O.B:", "15 Jan 1990"],
      ["Address:", "1 Bridge Street\nWorksop", "ID provided:", "Passport"],
      ["Postcode:", "S80 1LX", "Design/placement", "Swallow · left forearm"],
      [
        "Telephone:",
        "07700 900123",
        "Tattoo Studio",
        "BOOTS &#x27;N&#x27; BANDIT",
      ],
      ["Email:", "megan@example.com", "Artist:", "Calum"],
    ];
    for (const cells of rows) {
      const [a, b, c, d] = cells;
      expect(html).toMatch(
        new RegExp(
          `<th scope="row">${a}</th><td[^>]*>${b}</td><th scope="row">${c}</th><td>${d}</td>`,
        ),
      );
    }
  });

  it("ticks the Yes or No column for every medical row", async () => {
    const html = await render();
    expect(html).toContain("Medical Condition");
    for (const q of V3.questions) {
      const answer = q.id === "medication" ? "Yes" : "No";
      const ticks =
        answer === "Yes"
          ? `<td class="yn"><span aria-label="ticked">✓</span></td><td class="yn"></td>`
          : `<td class="yn"></td><td class="yn"><span aria-label="ticked">✓</span></td>`;
      expect(html).toContain(`<tr data-answer="${answer}"><td><b>${q.q}</b>`);
      expect(html).toContain(`<i>${q.explanation}</i></td>${ticks}`);
    }
    expect(html).toContain(`<i>${V3.furtherDetailsPrompt}</i>`);
    expect(html).toContain("Sertraline 50mg");
  });

  it("prints client information, every statement and the agreement on page two", async () => {
    const html = await render();
    expect(html).toContain('<section class="cp-second">');
    expect(html).toContain(".cp-second { break-before: page;");
    expect(html).toContain("CLIENT INFORMATION;");
    expect(html).toContain(
      "<b>Scarring, Blood Poisoning (Septicaemia), Localised Infection, Allergic reactions to pigment, Localised swelling around the area.</b>",
    );
    expect(html).toContain("INDIVIDUAL CONSENT;");
    for (const s of V3.statements!)
      expect(html).toContain(`<li>${s.text}</li>`);
    expect(html).toContain("☑ I have read and agree to all of the above");
  });

  it("prints both signatures with their dates", async () => {
    const html = await render();
    expect(html).toContain("Client Signature;");
    expect(html).toContain('src="data:image/png;base64,CLIENTSIG"');
    expect(html).toContain("Artist Signature;");
    expect(html).toContain('src="data:image/png;base64,ARTISTSIG"');
    expect(html.match(/Date; <span[^>]*>01 Nov 2026<\/span>/g)).toHaveLength(2);
    expect(html).toContain("consent form v3");
    expect(html).toContain("record f3");
  });
});

describe("consent print page — older kiosk forms", () => {
  it("prints a v2 form in the same frame with what it recorded", async () => {
    findFirst.mockResolvedValue(v2Booking());
    const html = await render("f2");
    expect(html).toContain("CLIENT CONSENT FORM");
    expect(html).toContain(">Question<");
    expect(html).toContain("Checked by Sarah");
    expect(html).toContain(
      '<b>Do you have diabetes?</b></td><td class="yn"></td>',
    );
    expect(html).toContain("Client Signature;");
    expect(html).not.toContain("Artist Signature;");
    expect(html).not.toContain("INDIVIDUAL CONSENT;");
    expect(html).not.toContain('class="cp-second"');
    expect(html).toContain("consent form v2");
  });

  it("prints a pre-snapshot v1 form against the v1 questions, light ink on a dark backing", async () => {
    const b = v2Booking();
    findFirst.mockResolvedValue({
      ...b,
      consentForm: {
        ...b.consentForm,
        id: "f1",
        formVersion: null,
        questions: null,
        printedName: null,
        dob: null,
        idCheckedBy: null,
        idCheckedAt: null,
        answers: { age: true },
      },
    });
    const html = await render("f1");
    expect(html).toContain("I am 18 or over and have photo ID with me today.");
    expect(html).toContain('class="dark"');
    expect(html).toContain("consent form v1");
  });
});
