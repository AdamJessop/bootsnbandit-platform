import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArtistForm,
  ArtistScreen,
  CONSENT_STEPS,
  ConsentScreen,
  CustomerFlow,
  artistProblem,
  designPlacementFor,
  initialDraft,
  signedDate,
  stepNextLabel,
  stepProblem,
  ukNational,
  type ConsentDraft,
  type ConsentStep,
} from "./CustomerFlow";
import {
  CONSENT_QUESTIONS,
  CURRENT_CONSENT_FORM,
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
    customerDob: null,
    artistId: "a1",
    style: null,
    placement: null,
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

/** React escapes quotes in text; compare against what it renders. */
const esc = (s: string) => s.replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

/** A customer half filled in completely and cleanly. */
const draft: ConsentDraft = {
  printedName: "Megan Wray",
  address: "1 Bridge Street, Worksop",
  postcode: "S80 1LX",
  phone: "07700 900123",
  email: "megan@example.com",
  dob: "1990-01-15",
  answers: Object.fromEntries(CONSENT_QUESTIONS.map((q) => [q.id, false])),
  medicalNotes: "",
  agreed: true,
  signature: "data:image/png;base64,AA",
};

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

function renderStep(step: ConsentStep, over: Partial<ConsentDraft> = {}) {
  return renderToStaticMarkup(
    <ConsentScreen
      session={sess()}
      artist={artist}
      onNext={() => {}}
      onBack={() => {}}
      initialStep={step}
      initialDraft={{ ...draft, ...over }}
    />,
  );
}

describe("ConsentScreen steps (paper order)", () => {
  it("runs details → medical → consent → sign", () => {
    expect(CONSENT_STEPS.map((s) => s.id)).toEqual([
      "details",
      "medical",
      "consent",
      "sign",
    ]);
    expect(CONSENT_STEPS.map((s) => stepNextLabel(s.id))).toEqual([
      "Next — medical",
      "Next — your consent",
      "Next — sign",
      "Done — hand to your artist",
    ]);
  });

  describe("1 · Your details", () => {
    const html = renderToStaticMarkup(
      <ConsentScreen
        session={sess({
          customerPhone: "+447700900123",
          customerEmail: "megan@example.com",
          customerDob: "1990-01-15",
        })}
        artist={artist}
        onNext={() => {}}
        onBack={() => {}}
      />,
    );

    it("opens on the details step with the step tracker", () => {
      expect(html).toContain("Client consent form, Megan");
      expect(html).toContain('aria-label="Step 1 of 4"');
      expect(html).toContain('aria-current="step"');
      for (const s of CONSENT_STEPS) expect(html).toContain(s.title);
    });

    it("asks for the paper form's client fields, prefilled from the booking", () => {
      for (const label of [
        "Client name",
        "Address",
        "Postcode",
        "Telephone",
        "Email",
        "Date of birth",
      ]) {
        expect(html).toContain(`>${label}`);
      }
      expect(html).toContain('value="Megan Wray"');
      expect(html).toContain('value="07700900123"');
      expect(html).toContain('value="megan@example.com"');
      expect(html).toContain('type="date"');
      expect(html).toContain('value="1990-01-15"');
    });

    it("holds the next button until the details are complete", () => {
      expect(html).toMatch(/<button class="btn btn-lg" disabled=""/);
      expect(html).toContain("Add your address");
    });

    it("warns an under-18 customer without blocking the form", () => {
      const young = renderStep("details", { dob: "2015-06-01" });
      expect(young).toContain("You need to be 18 or over");
      expect(young).toContain("Next — medical");
    });

    it("shows an inline message on a malformed field", () => {
      const bad = renderStep("details", { postcode: "12345" });
      expect(bad).toContain("That doesn&#x27;t look like a UK postcode");
      expect(bad).toContain('aria-invalid="true"');
    });
  });

  describe("2 · Medical", () => {
    it("shows every condition with its explanation and Yes/No", () => {
      const html = renderStep("medical", { answers: {} });
      for (const q of CURRENT_CONSENT_FORM.questions) {
        expect(html).toContain(esc(q.q));
        expect(html).toContain(esc(q.explanation!));
      }
      expect(html.match(/class="yes /g)).toHaveLength(12);
      expect(html.match(/class="no /g)).toHaveLength(12);
      expect(html).toContain(
        "If you answered yes to any of the above, please give further details",
      );
      expect(html).toContain("(only if you answered Yes)");
      expect(html).toContain("Answer every question to carry on");
    });

    it("makes further details required as soon as anything is Yes", () => {
      const html = renderStep("medical", {
        answers: { ...draft.answers, diabetes: true },
      });
      expect(html).toContain("(required)");
      expect(html).toContain('aria-required="true"');
      expect(html).toContain("Add further details to carry on");
      expect(html).toContain("quick word with your artist about that answer");
      const ok = renderStep("medical", {
        answers: { ...draft.answers, diabetes: true },
        medicalNotes: "Type 1, well controlled",
      });
      expect(ok).toContain("Next — your consent");
    });
  });

  describe("3 · Client information and consent", () => {
    it("shows the risks and every statement in full, with one agreement", () => {
      const html = renderStep("consent", { agreed: false });
      const form = CURRENT_CONSENT_FORM;
      expect(html).toContain("Client information");
      expect(html).toContain(esc(form.clientInformation!.intro));
      for (const r of form.clientInformation!.risks) {
        expect(html).toContain(esc(r));
      }
      expect(html).toContain("Individual consent");
      for (const s of form.statements!) expect(html).toContain(esc(s.text));
      expect(html.match(/role="checkbox"/g)).toHaveLength(1);
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain("I have read and agree to all of the above");
      expect(html).toContain("Tick the box to agree and carry on");
    });

    it("lets the customer carry on once they agree", () => {
      const html = renderStep("consent", { agreed: true });
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("Next — sign");
    });
  });

  describe("4 · Client signature", () => {
    it("shows the signature pad with the client's name and today's date", () => {
      const html = renderStep("sign");
      expect(html).toContain("Client signature — Megan Wray");
      expect(html).toContain("<canvas");
      expect(html).toContain(`Date: <b>${signedDate()}</b>`);
      expect(html).toContain("Sign above to finish");
    });
  });
});

describe("stepProblem", () => {
  it("is clear for a complete draft on every step (sign once signed)", () => {
    for (const s of CONSENT_STEPS) {
      expect(stepProblem(s.id, draft, true)).toBeNull();
    }
    expect(stepProblem("sign", draft, false)).toBe("Sign above to finish");
  });

  it("names the first missing detail", () => {
    expect(stepProblem("details", { ...draft, phone: "" }, false)).toBe(
      "Add a phone number",
    );
    expect(stepProblem("details", { ...draft, email: "nope" }, false)).toBe(
      "That doesn't look like an email address",
    );
  });

  it("requires every row answered and details after any Yes", () => {
    expect(stepProblem("medical", { ...draft, answers: {} }, false)).toBe(
      "Answer every question to carry on",
    );
    expect(
      stepProblem(
        "medical",
        { ...draft, answers: { ...draft.answers, other: true } },
        false,
      ),
    ).toBe("Add further details to carry on");
  });

  it("requires the agreement", () => {
    expect(stepProblem("consent", { ...draft, agreed: false }, false)).toBe(
      "Tick the box to agree and carry on",
    );
  });
});

describe("initialDraft", () => {
  it("prefills what the booking knows and leaves the rest blank", () => {
    const d = initialDraft(
      sess({
        customerPhone: "+447700900123",
        customerEmail: "megan@example.com",
        customerDob: "1990-01-15",
      }),
    );
    expect(d).toMatchObject({
      printedName: "Megan Wray",
      phone: "07700900123",
      email: "megan@example.com",
      dob: "1990-01-15",
      address: "",
      postcode: "",
      answers: {},
      agreed: false,
    });
  });

  it("ukNational reads +44 numbers the way people write them", () => {
    expect(ukNational("+447700900123")).toBe("07700900123");
    expect(ukNational("+33612345678")).toBe("+33612345678");
    expect(ukNational(null)).toBe("");
  });
});

describe("ArtistScreen (behind the staff gate)", () => {
  it("shows only the staff unlock until it is passed", () => {
    const html = renderToStaticMarkup(
      <ArtistScreen
        session={sess()}
        draft={draft}
        artists={[artist]}
        pinConfigured={false}
        onVerifyPin={verifyPin}
        onSubmit={async () => ({ ok: true })}
        onBack={() => {}}
      />,
    );
    expect(html).toContain("Over to your artist");
    expect(html).toContain("Hold to open the artist&#x27;s part");
    expect(html).toContain("Staff only — record what ID was shown.");
    expect(html).not.toContain("Driving licence");
    expect(html).not.toContain("<canvas");
  });

  it("uses the PIN pad when a studio PIN is set", () => {
    const html = renderToStaticMarkup(
      <ArtistScreen
        session={sess()}
        draft={draft}
        artists={[artist]}
        pinConfigured
        onVerifyPin={verifyPin}
        onSubmit={async () => ({ ok: true })}
        onBack={() => {}}
      />,
    );
    expect(html).toContain("rk-pin-keys");
  });
});

describe("ArtistForm (the artist's half)", () => {
  const render = (
    over: Partial<ConsentDraft> = {},
    session: Partial<BoardSession> = {},
  ) =>
    renderToStaticMarkup(
      <ArtistForm
        session={sess({ style: "Fine line", placement: "Forearm", ...session })}
        draft={{ ...draft, ...over }}
        artists={[
          { ...artist, id: "a2", name: "Rhodri", checkedIn: true },
          artist,
        ]}
        onSubmit={async () => ({ ok: true })}
      />,
    );

  it("shows the studio, the booking's artist, ID, design and the artist signature", () => {
    const html = render();
    expect(html).toContain("Tattoo studio");
    expect(html).toContain("Boots &#x27;n&#x27; Bandit");
    // The booking's artist is preselected and listed first.
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Sarah/);
    expect(html.indexOf("Sarah")).toBeLessThan(html.indexOf("Rhodri"));
    for (const t of [
      "Passport",
      "Driving licence",
      "Citizen/PASS card",
      "Other",
      "None provided",
    ]) {
      expect(html).toContain(`>${t}</button>`);
    }
    expect(html).toContain("choose None provided if there was none.");
    expect(html).toContain('value="Fine line · Forearm"');
    expect(html).toContain("Artist signature — Sarah");
    expect(html).toContain("<canvas");
    expect(html).toContain(`Date: <b>${signedDate()}</b>`);
  });

  it("won't complete until an ID type is chosen", () => {
    const html = render();
    expect(html).toMatch(/<button class="btn btn-lg" disabled=""/);
    expect(html).toMatch(
      /disabled="">.*Record what ID was shown — or None provided</,
    );
  });

  it("hands the artist the name and DOB to check against the ID", () => {
    const html = render();
    expect(html).toContain("Megan Wray");
    expect(html).toContain("15 Jan 1990");
  });

  it("warns when the date of birth is under 18", () => {
    expect(render({ dob: "2015-06-01" })).toContain(
      "Under 18 — no tattoo today",
    );
  });

  it("lists flagged answers with the further details", () => {
    const html = render({
      answers: { ...draft.answers, diabetes: true },
      medicalNotes: "Type 1",
    });
    expect(html).toContain("1 answer to talk through");
    expect(html).toContain("Diabetes");
    expect(html).toContain("Type 1");
  });
});

describe("artistProblem", () => {
  const ok = {
    artistId: "a1",
    idType: "passport",
    idOther: "",
    designPlacement: "",
  };
  it("is clear once an ID is recorded and the artist has signed", () => {
    expect(artistProblem(ok, true)).toBeNull();
  });
  it("names what's missing, ID first", () => {
    expect(artistProblem({ ...ok, idType: "" }, true)).toBe(
      "Record what ID was shown — or None provided",
    );
    // Like the paper box, "None provided" is a recorded answer, not a block.
    expect(artistProblem({ ...ok, idType: "none" }, true)).toBeNull();
    expect(artistProblem({ ...ok, idType: "other" }, true)).toBe(
      "Say what ID was provided",
    );
    expect(
      artistProblem({ ...ok, idType: "other", idOther: "Military ID" }, true),
    ).toBeNull();
    expect(artistProblem({ ...ok, artistId: "" }, true)).toBe(
      "Pick the artist",
    );
    expect(artistProblem(ok, false)).toBe("Artist signature needed");
  });
});

describe("designPlacementFor", () => {
  it("joins the booking's style and placement", () => {
    expect(
      designPlacementFor({ style: "Fine line", placement: "Forearm" }),
    ).toBe("Fine line · Forearm");
    expect(designPlacementFor({ style: null, placement: " Calf " })).toBe(
      "Calf",
    );
    expect(designPlacementFor({ style: null, placement: null })).toBe("");
  });
});
