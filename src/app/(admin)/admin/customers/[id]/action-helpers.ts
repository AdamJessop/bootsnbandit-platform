/**
 * Pure validators for the customer-detail server actions (kept out of the
 * "use server" module so they unit-test without server-only imports).
 */

export type ManualEmailResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; error: string };

export function validateManualEmail(input: {
  subject: string;
  body: string;
}): ManualEmailResult {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) return { ok: false, error: "A subject is required." };
  if (!body) return { ok: false, error: "A message body is required." };
  return { ok: true, subject, body };
}

export interface NotesPatch {
  notes: string | null;
  marketingConsent: boolean;
}

export function validateNotes(input: {
  notes: string;
  marketingConsent: boolean;
}): NotesPatch {
  const notes = input.notes.trim();
  return {
    notes: notes === "" ? null : notes,
    marketingConsent: input.marketingConsent,
  };
}
