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
 */

export type ConsentSection = "today" | "health" | "consent";

export interface ConsentQuestion {
  id: string;
  q: string;
  /** The answer that needs no follow-up; the other one flags the form. */
  expect: "yes" | "no";
  section: ConsentSection;
}

export interface ConsentFormDefinition {
  version: number;
  questions: ReadonlyArray<ConsentQuestion>;
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

export const CONSENT_FORMS: Readonly<Record<number, ConsentFormDefinition>> = {
  1: V1,
  2: V2,
};

export const CURRENT_CONSENT_VERSION = 2;

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
