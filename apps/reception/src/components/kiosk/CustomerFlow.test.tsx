import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ConsentScreen,
  CustomerFlow,
  IdCheckScreen,
  consentFootLabel,
  type ConsentDraft,
} from "./CustomerFlow";
import {
  CONSENT_QUESTIONS,
  CONSENT_SECTIONS,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

const artist: BoardArtist = {
  id: "a1",
  name: "Sarah",
  status: "CO_OWNER",
  tag: null,
  headshot: null,
  hue: "crimson",
  hourlyRatePence: 9000,
  onLeave: false,
  checkedIn: true,
};

function sess(over: Partial<BoardSession> = {}): BoardSession {
  return {
    id: "s1",
    customerId: "c1",
    customerName: "Megan Wray",
    customerPhone: null,
    customerEmail: null,
    artistId: "a1",
    start: new Date(2026, 6, 7, 10, 0).toISOString(),
    end: new Date(2026, 6, 7, 13, 0).toISOString(),
    durationMin: 180,
    type: "session",
    status: "confirmed",
    checkedInAt: null,
    consentFlagged: null,
    idCheckedBy: null,
    completed: false,
    amountChargedPence: null,
    ...over,
  };
}

const verifyPin = async () => ({ ok: true }) as const;

describe("CustomerFlow picker", () => {
  it("lists only sessions still awaiting arrival", () => {
    const html = renderToStaticMarkup(
      <CustomerFlow
        artists={[artist]}
        sessions={[
          sess(),
          sess({
            id: "here",
            customerName: "Already Here",
            checkedInAt: new Date().toISOString(),
          }),
        ]}
        pinConfigured={false}
        onVerifyPin={verifyPin}
        onCheckin={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).not.toContain("Already Here");
    expect(html).toContain("find your session");
  });

  it("shows only first name + last initial and the time — never full names", () => {
    const html = renderToStaticMarkup(
      <CustomerFlow
        artists={[artist]}
        sessions={[sess()]}
        pinConfigured={false}
        onVerifyPin={verifyPin}
        onCheckin={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Megan W.");
    expect(html).not.toContain("Megan Wray");
    expect(html).toContain("10:00");
  });

  it("shows the all-checked-in empty state", () => {
    const html = renderToStaticMarkup(
      <CustomerFlow
        artists={[artist]}
        sessions={[]}
        pinConfigured={false}
        onVerifyPin={verifyPin}
        onCheckin={async () => ({ ok: true })}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Everyone’s checked in");
  });
});

describe("ConsentScreen", () => {
  const html = renderToStaticMarkup(
    <ConsentScreen
      session={sess()}
      artist={artist}
      onNext={() => {}}
      onBack={() => {}}
    />,
  );

  it("renders every consent question, grouped by section, with yes/no controls", () => {
    for (const q of CONSENT_QUESTIONS) {
      expect(html).toContain(q.q.replace(/'/g, "&#x27;"));
    }
    for (const s of CONSENT_SECTIONS) expect(html).toContain(s.title);
    expect(html).toContain("doesn’t mean we can’t");
  });

  it("asks for printed name (pre-filled), date of birth and a signature", () => {
    expect(html).toContain('id="rk-printed"');
    expect(html).toContain('value="Megan Wray"');
    expect(html).toContain('type="date"');
    expect(html).toContain("Date of birth");
    expect(html).toContain("Signature — Megan Wray");
    expect(html).toContain("<canvas");
  });

  it("offers the optional medical detail and photo consent", () => {
    expect(html).toContain("Anything else we should know?");
    expect(html).toContain('maxLength="1000"');
    expect(html).toContain("photograph your finished piece");
    expect(html).toContain("(optional)");
  });

  it("keeps the finish button disabled until everything is done", () => {
    expect(html).toContain("Answer all questions to finish");
    expect(html).toMatch(/<button class="btn btn-lg" disabled=""/);
  });
});

describe("consentFootLabel", () => {
  const done = { answered: true, named: true, dobValid: true, signed: true };
  it("names the next missing step, in order", () => {
    expect(consentFootLabel({ ...done, answered: false })).toBe(
      "Answer all questions to finish",
    );
    expect(consentFootLabel({ ...done, named: false })).toBe(
      "Print your full name",
    );
    expect(consentFootLabel({ ...done, dobValid: false })).toBe(
      "Add your date of birth",
    );
    expect(consentFootLabel({ ...done, signed: false })).toBe(
      "Sign above to finish",
    );
    expect(consentFootLabel(done)).toBe("Done — hand to the front desk");
  });
});

describe("IdCheckScreen (staff confirms photo ID)", () => {
  const draft: ConsentDraft = {
    answers: Object.fromEntries(
      CONSENT_QUESTIONS.map((q) => [q.id, q.expect === "yes"]),
    ),
    printedName: "Megan Wray",
    dob: "1990-01-15",
    medicalNotes: "",
    photoConsent: null,
    signature: "data:image/png;base64,AA",
  };
  const render = (over: Partial<ConsentDraft> = {}, pinConfigured = false) =>
    renderToStaticMarkup(
      <IdCheckScreen
        session={sess()}
        draft={{ ...draft, ...over }}
        artists={[
          artist,
          { ...artist, id: "a2", name: "Rhodri", checkedIn: false },
        ]}
        pinConfigured={pinConfigured}
        onVerifyPin={verifyPin}
        onSubmit={async () => ({ ok: true })}
        onBack={() => {}}
      />,
    );

  it("hands over to the crew with the name and DOB to check against the ID", () => {
    const html = render();
    expect(html).toContain("Over to the front desk");
    expect(html).toContain("Megan Wray");
    expect(html).toContain("15 Jan 1990");
    expect(html).toContain("Who checked the ID?");
    expect(html).toContain("Sarah");
    expect(html).toContain("Rhodri");
  });

  it("warns staff when the date of birth is under 18", () => {
    const html = render({ dob: "2015-06-01" });
    expect(html).toContain("Under 18 — no tattoo today");
  });

  it("lists flagged answers for the conversation", () => {
    const html = render({ answers: { ...draft.answers, diabetes: true } });
    expect(html).toContain("1 answer to talk through");
    expect(html).toContain("Do you have diabetes?");
  });
});
