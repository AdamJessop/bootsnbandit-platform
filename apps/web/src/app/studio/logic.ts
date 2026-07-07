/**
 * Pure logic for the studio "Get in touch" form: validation + mapping to the
 * `POST /api/enquiries` body. The single "email or phone" field is classified
 * so the enquiry lands with a usable contact method.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StudioContactInput {
  name: string;
  /** Email address or phone number — a single free-text field. */
  contact: string;
  message: string;
}

/** Name, a plausible contact (email or ≥6-char phone) and a message required. */
export function isStudioContactValid(input: StudioContactInput): boolean {
  if (input.name.trim().length === 0) return false;
  if (input.message.trim().length === 0) return false;
  const contact = input.contact.trim();
  return EMAIL_RE.test(contact) || contact.replace(/\s/g, "").length >= 6;
}

export interface StudioContactPayload {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string;
  source: "web";
}

/** Map the form to the enquiries body, prefixing the message for triage. */
export function buildStudioContactPayload(
  input: StudioContactInput,
): StudioContactPayload {
  const contact = input.contact.trim();
  const isEmail = EMAIL_RE.test(contact);
  return {
    contactName: input.name.trim(),
    contactEmail: isEmail ? contact : null,
    contactPhone: !isEmail && contact ? contact : null,
    description: `Studio contact: ${input.message.trim()}`,
    source: "web",
  };
}
