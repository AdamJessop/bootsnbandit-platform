/**
 * The front-desk consent form — the versioned question set the reception
 * kiosk shows, the server action validates against, and the admin consent
 * viewer reads back. Client-safe (no prisma runtime import), like
 * `artist-status`.
 *
 * Every question has an `expect`ed answer; any other answer flags the form so
 * the front desk has a word before the session starts. A flag never blocks
 * check-in — it is a prompt for a conversation, not a refusal.
 *
 * Changing the wording or the set of questions means a NEW version: add it to
 * `CONSENT_FORMS` and point `CURRENT_CONSENT_VERSION` at it. Old versions
 * stay so forms signed under them still read back correctly (each new form
 * also stores a snapshot of exactly what was shown).
 *
 * v3 is the studio's own paper "Client Consent Form" made digital: the same
 * client fields, the same medical table (condition + why it matters), the
 * same client-information risks and the same individual consent statements.
 * The kiosk, the server action, the stored snapshot, the admin viewer and the
 * print page all read it from here.
 */

export type ConsentSection = "today" | "health" | "consent" | "medical";

export interface ConsentQuestion {
  id: string;
  /** The question or statement — on v3, the condition (bold on paper). */
  q: string;
  /** v3: why the condition matters (italic after it on paper). */
  explanation?: string;
  /** The answer that needs no follow-up; the other one flags the form. */
  expect: "yes" | "no";
  section: ConsentSection;
}

/** One "Individual consent" statement the client agrees to (v3+). */
export interface ConsentStatement {
  id: string;
  text: string;
}

/** The paper form's "Client information" block: the known risks (v3+). */
export interface ConsentClientInformation {
  intro: string;
  risks: ReadonlyArray<string>;
}

export interface ConsentFormDefinition {
  version: number;
  questions: ReadonlyArray<ConsentQuestion>;
  /** v3+: label of the free-text box that is required after any "Yes". */
  furtherDetailsPrompt?: string;
  /** v3+: the known risks, shown before the consent statements. */
  clientInformation?: ConsentClientInformation;
  /** v3+: statements agreed in full with ONE acknowledgement (`agreeLabel`). */
  statements?: ReadonlyArray<ConsentStatement>;
  agreeLabel?: string;
}

/**
 * v1 — the launch form (eight yes/no statements). Every statement is phrased
 * so Yes is the safe answer. The original code only flagged four of them;
 * the expectations here are the corrected reading, used to highlight answers
 * on v1 forms in the admin viewer.
 */
const V1: ConsentFormDefinition = {
  version: 1,
  questions: [
    {
      id: "age",
      q: "I am 18 or over and have photo ID with me today.",
      expect: "yes",
      section: "today",
    },
    {
      id: "eaten",
      q: "I have eaten within the last 4 hours.",
      expect: "yes",
      section: "today",
    },
    {
      id: "sober",
      q: "I am not under the influence of alcohol or drugs.",
      expect: "yes",
      section: "today",
    },
    {
      id: "skin",
      q: "The skin at the tattoo area is free of cuts, rashes and sunburn.",
      expect: "yes",
      section: "today",
    },
    {
      id: "preg",
      q: "I am not pregnant or breastfeeding.",
      expect: "yes",
      section: "today",
    },
    {
      id: "medical",
      q: "I have no medical condition affecting healing (or I have already discussed it with my artist).",
      expect: "yes",
      section: "health",
    },
    {
      id: "consent",
      q: "I understand a tattoo is permanent and I consent to the procedure.",
      expect: "yes",
      section: "consent",
    },
    {
      id: "aftercare",
      q: "I agree to follow the aftercare guidance I am given.",
      expect: "yes",
      section: "consent",
    },
  ],
};

/**
 * v2 — adds the health questions a UK studio asks (blood thinners, diabetes,
 * epilepsy, heart, blood-borne viruses, keloid scarring, allergies). Health
 * questions are asked as questions ("Do you…?") where No is the expected
 * answer; the "about today" and consent lines stay as statements where Yes is.
 * The optional medical detail and photo consent live outside the yes/no set.
 */
const V2: ConsentFormDefinition = {
  version: 2,
  questions: [
    {
      id: "age",
      q: "I am 18 or over and have photo ID with me today.",
      expect: "yes",
      section: "today",
    },
    {
      id: "eaten",
      q: "I have eaten something in the last 4 hours.",
      expect: "yes",
      section: "today",
    },
    {
      id: "sober",
      q: "I haven't had alcohol or drugs today.",
      expect: "yes",
      section: "today",
    },
    {
      id: "skin",
      q: "The skin where I'm being tattooed is free of cuts, rashes and sunburn.",
      expect: "yes",
      section: "today",
    },
    {
      id: "preg",
      q: "Are you pregnant or breastfeeding?",
      expect: "no",
      section: "health",
    },
    {
      id: "bloodThinners",
      q: "Do you take blood-thinning medication (such as warfarin, or aspirin every day)?",
      expect: "no",
      section: "health",
    },
    {
      id: "diabetes",
      q: "Do you have diabetes?",
      expect: "no",
      section: "health",
    },
    {
      id: "epilepsy",
      q: "Do you have epilepsy, or have you ever had a seizure or fit?",
      expect: "no",
      section: "health",
    },
    {
      id: "heart",
      q: "Do you have a heart condition?",
      expect: "no",
      section: "health",
    },
    {
      id: "bloodBorne",
      q: "Do you have a blood-borne virus, such as hepatitis B or C, or HIV?",
      expect: "no",
      section: "health",
    },
    {
      id: "keloid",
      q: "Have you ever had keloid or raised scarring?",
      expect: "no",
      section: "health",
    },
    {
      id: "allergies",
      q: "Are you allergic to anything we might use — latex, tattoo inks, plasters or soaps?",
      expect: "no",
      section: "health",
    },
    {
      id: "medical",
      q: "Is there any other medical condition or medication that might affect healing?",
      expect: "no",
      section: "health",
    },
    {
      id: "consent",
      q: "I understand a tattoo is permanent and I consent to the procedure.",
      expect: "yes",
      section: "consent",
    },
    {
      id: "aftercare",
      q: "I agree to follow the aftercare guidance I am given.",
      expect: "yes",
      section: "consent",
    },
  ],
};

/**
 * v3 — the studio's paper Client Consent Form, word for word (the paper's
 * "prong" fixed to "prone", the waiver's garbled grammar lightly corrected
 * with its meaning kept, and — at the studio's request — tattoo-only wording:
 * "tattoo/piercing" reads "tattoo" and the jewellery mentions are gone).
 * Every medical row is a Yes/No where No is
 * expected; any Yes flags the form and makes the further-details box
 * required. The paper's last row ("If yes to any above — please give further
 * details on the back of your form") IS that box. The v2 extras that are not
 * on the paper (eaten, photo consent, the separate age and sober ticks) are
 * gone: statement "accurate" covers age and "sober" covers alcohol and drugs.
 */
const V3_MEDICAL: ReadonlyArray<
  Pick<ConsentQuestion, "id" | "q" | "explanation">
> = [
  {
    id: "skin",
    q: "Eczema, Psoriasis, Acne, Cellulitis, or other skin condition",
    explanation: "prone to skin infection",
  },
  {
    id: "heart",
    q: "Heart Disorders",
    explanation:
      "more prone to serious heart complications from blood infections",
  },
  {
    id: "bloodPressure",
    q: "High/Low Blood Pressure",
    explanation: "can cause light headedness",
  },
  {
    id: "epilepsy",
    q: "Epilepsy or other form of seizures",
    explanation:
      "medication may cause side effects and may result in fitting during treatment",
  },
  {
    id: "diabetes",
    q: "Diabetes",
    explanation:
      "can reduce healing properties of the skin, resulting in infection",
  },
  {
    id: "hepatitis",
    q: "Hepatitis",
    explanation: "may pose risk for operator",
  },
  {
    id: "autoimmune",
    q: "Autoimmune Disease or treatment causing it e.g cancer treatment",
    explanation: "may be prone to serious infection",
  },
  {
    id: "allergies",
    q: "Allergies especially nickel allergy",
    explanation:
      "may result in serious skin reactions present on products used. I.e ink",
  },
  {
    id: "pregnant",
    q: "Pregnant",
    explanation:
      "immune response affected by pregnancy and any infection may affect unborn child",
  },
  {
    id: "nursing",
    q: "Nursing mother",
    explanation: "risk of infection can be a risk to the baby",
  },
  {
    id: "medication",
    q: "Medication",
    explanation: "side effects may affect healing and recovery from treatment",
  },
  {
    id: "other",
    q: "Any other condition not listed",
    explanation: "please give further details below",
  },
];

const V3: ConsentFormDefinition = {
  version: 3,
  questions: V3_MEDICAL.map(
    (q): ConsentQuestion => ({ ...q, expect: "no", section: "medical" }),
  ),
  furtherDetailsPrompt:
    "If you answered yes to any of the above, please give further details",
  clientInformation: {
    intro: "Known (potential) risks associated with tattooing:",
    risks: [
      "Scarring",
      "Blood Poisoning (Septicaemia)",
      "Localised Infection",
      "Allergic reactions to pigment",
      "Localised swelling around the area",
    ],
  },
  statements: [
    {
      id: "questions",
      text: "I acknowledge by signing this agreement that I have been given the full opportunity to ask any questions which I might have about obtaining a tattoo and that all my questions have been answered to my satisfaction.",
    },
    {
      id: "allergy",
      text: "I acknowledge that it is not reasonably possible to determine whether I might have an allergic reaction to the pigments or the process used in my tattoo and I agree to accept that such risk is possible.",
    },
    {
      id: "inkRisk",
      text: "I acknowledge that there may be a risk associated with the ink products used in tattooing and that such ink products may contain substances which are potentially harmful to my health.",
    },
    {
      id: "consent",
      text: "I declare that I give my full consent to the tattoo being carried out by the aforementioned operator. I confirm that potential complications, e.g. infection, swelling, for the procedure undertaken are always possible, particularly in the event that I do not take proper care of my tattoo. I confirm that the aftercare instructions have been explained to me and that it is my responsibility to follow the aftercare instructions until the site has healed. Any aftercare advice which has not been followed due to negligence, I agree that the work will be done at my own expense.",
    },
    {
      id: "accurate",
      text: "I confirm that the information I have provided above for this consent form is correct and to the best of my knowledge, that I am over 18 years of age.",
    },
    {
      id: "waiver",
      text: "I waive and release to the fullest extent permitted by law any persons of the tattoo studio from all liability whatsoever, including but not limited to any and all claims or causes of action that may occur, including direct or indirect consequential damages which may arise during or from the application of the procedure, negligence or aftercare.",
    },
    {
      id: "sober",
      text: "I am not under the influence of alcohol or drugs and I am voluntarily submitting to being tattooed by the tattoo studio without duress or coercion.",
    },
    {
      id: "design",
      text: "I realise that variations in colour and design may exist and the final design has been chosen by myself and I am happy to proceed, understanding that in time these colours will not be as vibrant.",
    },
    {
      id: "skinTreatment",
      text: "I understand that if I have any skin treatment including but not limited to laser hair removal, plastic surgery or any other type of skin treatment, this may alter or have adverse changes on the area that has been tattooed and the studio will not be held liable.",
    },
    {
      id: "notMedical",
      text: "I understand that tattoo artists are not medical professionals and can/will make suggestions, but these will not be construed as or substituted for advice from a medical professional.",
    },
    {
      id: "disclosure",
      text: "Failure to declare any medical conditions and the result, including but not limited to infection, poor healing etc., due to failure to disclose will not be held liable by the tattoo studio.",
    },
  ],
  agreeLabel: "I have read and agree to all of the above",
};

export const CONSENT_FORMS: Readonly<Record<number, ConsentFormDefinition>> = {
  1: V1,
  2: V2,
  3: V3,
};

export const CURRENT_CONSENT_VERSION = 3;

export const CURRENT_CONSENT_FORM: ConsentFormDefinition =
  CONSENT_FORMS[CURRENT_CONSENT_VERSION];

/** Section headings, in display order. */
export const CONSENT_SECTIONS: ReadonlyArray<{
  id: ConsentSection;
  title: string;
}> = [
  { id: "today", title: "About today" },
  { id: "health", title: "Your health" },
  { id: "consent", title: "Your consent" },
  { id: "medical", title: "Medical condition" },
];

/** Max length of the optional "anything we should know" medical note. */
export const MEDICAL_NOTES_MAX = 1000;

/**
 * The question set a stored form was signed under. Forms from before the
 * snapshot columns existed have no version and were all v1.
 */
export function consentFormFor(version: number | null | undefined) {
  return CONSENT_FORMS[version ?? 1] ?? V1;
}

/** True when `answer` is the one that needs a word with the front desk. */
export function isFlaggedAnswer(
  q: Pick<ConsentQuestion, "expect">,
  answer: boolean | undefined,
): boolean {
  if (answer === undefined) return false;
  return answer !== (q.expect === "yes");
}

/** Questions whose answer needs reviewing (the unexpected answer given). */
export function flaggedQuestions(
  answers: Record<string, boolean>,
  questions: ReadonlyArray<ConsentQuestion> = CURRENT_CONSENT_FORM.questions,
): ConsentQuestion[] {
  return questions.filter((q) => isFlaggedAnswer(q, answers[q.id]));
}

export function allAnswered(
  answers: Record<string, boolean>,
  questions: ReadonlyArray<ConsentQuestion> = CURRENT_CONSENT_FORM.questions,
): boolean {
  return questions.every((q) => typeof answers[q.id] === "boolean");
}

/**
 * Whole years between a YYYY-MM-DD date of birth and `on` (local calendar).
 * Returns null for anything that isn't a real past date.
 */
export function ageOn(dob: string, on: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const born = new Date(y, mo - 1, d);
  if (
    born.getFullYear() !== y ||
    born.getMonth() !== mo - 1 ||
    born.getDate() !== d ||
    born.getTime() > on.getTime()
  ) {
    return null;
  }
  let age = on.getFullYear() - y;
  if (
    on.getMonth() < mo - 1 ||
    (on.getMonth() === mo - 1 && on.getDate() < d)
  ) {
    age -= 1;
  }
  return age;
}

/** UK legal minimum age for a tattoo (Tattooing of Minors Act 1969). */
export const MIN_TATTOO_AGE = 18;

/**
 * Whether a completed form needs a word with the front desk: any flagged
 * answer, or a date of birth that makes the customer under 18. (Under-18s are
 * flagged rather than blocked — a consultation is fine; the tattoo is not.)
 */
export function isFormFlagged(
  answers: Record<string, boolean>,
  dob: string,
  on: Date = new Date(),
  questions: ReadonlyArray<ConsentQuestion> = CURRENT_CONSENT_FORM.questions,
): boolean {
  if (flaggedQuestions(answers, questions).length > 0) return true;
  const age = ageOn(dob, on);
  return age != null && age < MIN_TATTOO_AGE;
}

// ---------------------------------------------------------------------------
// v3: the paper form's fields
// ---------------------------------------------------------------------------

/** Pre-printed in the paper form's "Tattoo Studio" box. */
export const CONSENT_STUDIO_NAME = "Boots 'n' Bandit";

/** Longest value accepted for each free-text field on the form. */
export const CONSENT_FIELD_MAX = {
  printedName: 120,
  address: 300,
  postcode: 10,
  phone: 30,
  email: 200,
  idOther: 80,
  designPlacement: 300,
} as const;

/**
 * "ID provided" — what the artist saw. "Other" needs a description. Like the
 * paper box, it records rather than gates: "None provided" is a valid answer,
 * so the artist always writes something down but a missing ID never blocks
 * check-in (the DOB still flags anyone under 18).
 */
export const ID_TYPES = [
  { id: "passport", label: "Passport" },
  { id: "driving_licence", label: "Driving licence" },
  { id: "pass_card", label: "Citizen/PASS card" },
  { id: "other", label: "Other" },
  { id: "none", label: "None provided" },
] as const;

export type IdType = (typeof ID_TYPES)[number]["id"];

/**
 * The stored "ID provided" text: the type's label, or "Other: <what>" — null
 * when nothing usable was given (no type, or Other with no description).
 */
export function idProvidedText(
  type: string | null | undefined,
  other?: string | null,
): string | null {
  const t = ID_TYPES.find((x) => x.id === type);
  if (!t) return null;
  if (t.id !== "other") return t.label;
  const what = other?.trim();
  return what ? `Other: ${what}` : null;
}

/** The customer's half of the header table — the yellow fields on paper. */
export interface ConsentDetails {
  printedName: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  /** YYYY-MM-DD. */
  dob: string;
}

export type ConsentDetailsErrors = Partial<
  Record<keyof ConsentDetails, string>
>;

/** Loose UK postcode shape ("S80 1LX", "s801lx", "SW1A 1AA"). */
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

/** Upper-cased with one space before the inward code; null when not a postcode. */
export function normalisePostcode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!POSTCODE.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/** Loose phone shape: 10–15 digits, optional leading +, spaces/dashes/brackets. */
export function looksLikePhone(raw: string): boolean {
  return /^\+?\d{10,15}$/.test(raw.trim().replace(/[\s\-()]/g, ""));
}

export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/** Oldest plausible client — anything beyond is a typo in the year. */
const MAX_AGE = 120;

/**
 * Field → message for whatever is missing or malformed on the details step.
 * An empty object means good to go. Shared by the kiosk (inline messages)
 * and the server action (which refuses anything this rejects).
 */
export function consentDetailsErrors(
  d: ConsentDetails,
  on: Date = new Date(),
): ConsentDetailsErrors {
  const errors: ConsentDetailsErrors = {};
  const max = CONSENT_FIELD_MAX;
  const name = d.printedName.trim();
  const address = d.address.trim();
  const phone = d.phone.trim();
  const email = d.email.trim();
  if (!name) errors.printedName = "Add your full name";
  else if (name.length > max.printedName)
    errors.printedName = "That name is too long";
  if (!address) errors.address = "Add your address";
  else if (address.length > max.address)
    errors.address = "That address is too long";
  if (!d.postcode.trim()) errors.postcode = "Add your postcode";
  else if (!normalisePostcode(d.postcode))
    errors.postcode = "That doesn't look like a UK postcode";
  if (!phone) errors.phone = "Add a phone number";
  else if (phone.length > max.phone || !looksLikePhone(phone))
    errors.phone = "That doesn't look like a phone number";
  if (!email) errors.email = "Add your email address";
  else if (email.length > max.email || !looksLikeEmail(email))
    errors.email = "That doesn't look like an email address";
  if (!d.dob) errors.dob = "Add your date of birth";
  else {
    const age = ageOn(d.dob, on);
    if (age == null || age > MAX_AGE) errors.dob = "Check your date of birth";
  }
  return errors;
}

/**
 * The further-details box is required as soon as any answer flags — on v3,
 * any medical row answered Yes (the paper's "If yes to any above").
 */
export function furtherDetailsRequired(
  answers: Record<string, boolean>,
  questions: ReadonlyArray<ConsentQuestion> = CURRENT_CONSENT_FORM.questions,
): boolean {
  return flaggedQuestions(answers, questions).length > 0;
}

// ---------------------------------------------------------------------------
// Stored snapshot
// ---------------------------------------------------------------------------

/**
 * What a signed form stores in `ConsentForm.questions`. v1/v2 stored the bare
 * question array; v3 stores this object so the risks text and the exact
 * statements the client agreed to travel with the record.
 */
export interface ConsentSnapshot {
  version: number;
  questions: ConsentQuestion[];
  furtherDetailsPrompt?: string;
  clientInformation?: ConsentClientInformation;
  statements?: ConsentStatement[];
  agreeLabel?: string;
  /** The client ticked `agreeLabel` for every statement above. */
  agreed?: boolean;
}

/** The JSON stored for a form signed under `form` (plain, serialisable). */
export function consentSnapshot(
  form: ConsentFormDefinition,
  agreed: boolean,
): ConsentSnapshot | ConsentQuestion[] {
  const questions = form.questions.map((q) => ({ ...q }));
  if (!form.statements) return questions;
  const info = form.clientInformation;
  return {
    version: form.version,
    questions,
    ...(form.furtherDetailsPrompt
      ? { furtherDetailsPrompt: form.furtherDetailsPrompt }
      : {}),
    ...(info
      ? { clientInformation: { intro: info.intro, risks: [...info.risks] } }
      : {}),
    statements: form.statements.map((s) => ({ ...s })),
    ...(form.agreeLabel ? { agreeLabel: form.agreeLabel } : {}),
    agreed,
  };
}

/** A stored form read back: everything shown, plus whether it was agreed. */
export interface ConsentSnapshotView {
  version: number;
  questions: ConsentQuestion[];
  furtherDetailsPrompt: string;
  clientInformation: ConsentClientInformation | null;
  statements: ConsentStatement[];
  agreeLabel: string;
  /** null = the form had no agreement step (v1/v2). */
  agreed: boolean | null;
}

function validQuestions(raw: unknown): ConsentQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return (raw as ConsentQuestion[]).filter(
    (q) => q && typeof q.id === "string" && typeof q.q === "string",
  );
}

/**
 * Read a stored snapshot back, whichever shape it was saved in, falling back
 * to the version's definition for anything missing (forms from before the
 * snapshot columns existed have none at all and were all v1).
 */
export function readConsentSnapshot(
  stored: unknown,
  version: number | null | undefined,
): ConsentSnapshotView {
  const def = consentFormFor(version);
  const obj =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Partial<ConsentSnapshot>)
      : null;
  const questions = validQuestions(obj ? obj.questions : stored) ?? [
    ...def.questions,
  ];
  const statements = Array.isArray(obj?.statements)
    ? obj.statements.filter(
        (s) => s && typeof s.id === "string" && typeof s.text === "string",
      )
    : (def.statements ?? []).map((s) => ({ ...s }));
  const info = obj?.clientInformation ?? def.clientInformation;
  return {
    version: version ?? 1,
    questions,
    furtherDetailsPrompt:
      obj?.furtherDetailsPrompt ?? def.furtherDetailsPrompt ?? "",
    clientInformation: info
      ? { intro: info.intro, risks: [...info.risks] }
      : null,
    statements,
    agreeLabel: obj?.agreeLabel ?? def.agreeLabel ?? "",
    agreed: typeof obj?.agreed === "boolean" ? obj.agreed : null,
  };
}
