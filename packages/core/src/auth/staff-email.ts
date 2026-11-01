import {
  emailFromDomain,
  inboundEmailDomain,
} from "@bnb/core/services/channels/email-format";

/**
 * Staff email rules (Studio › Staff invite + edit). Pure apart from env reads,
 * so every rule is unit-testable.
 *
 * Staff sign in by email and their invite arrives by email, so the address has
 * to be one they actually read. Our own domain is the one address they can't:
 * everything sent TO it is routed into the enquiry inbox, and mail FROM it
 * (the invite itself leaves from studio@<domain>) is dropped there as a loop.
 */

/** Deliberately loose — the real test is the invite email arriving. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_STAFF_NAME_CHARS = 100;

export function normaliseStaffEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** True when `host` is `domain` or one of its subdomains. */
function within(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Drop the left-most label (mail.example.com → example.com) once. */
function parentOf(domain: string): string | null {
  const parts = domain.split(".");
  return parts.length > 2 ? parts.slice(1).join(".") : null;
}

/**
 * The studio's own mail domains: `INBOUND_EMAIL_DOMAIN` (and, when that is a
 * subdomain such as mail.example.com, its parent — the brand domain whose mail
 * is routed into the same inbox) plus the domain transactional mail is sent
 * from.
 */
export function studioMailDomains(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const out = new Set<string>();
  const inbound = inboundEmailDomain(env);
  if (inbound) {
    out.add(inbound);
    const parent = parentOf(inbound);
    if (parent) out.add(parent);
  }
  const from = emailFromDomain(env);
  if (from) out.add(from);
  return [...out];
}

/**
 * Validates a staff email. Returns an owner-facing error sentence, or null when
 * the address is usable. Expects an already-normalised address.
 */
export function staffEmailProblem(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!email) return "Email is required.";
  if (!EMAIL.test(email)) return "That doesn't look like an email address.";
  const host = email.slice(email.lastIndexOf("@") + 1);
  if (studioMailDomains(env).some((d) => within(host, d))) {
    return `Mail to @${host} goes to the enquiry inbox — invite their personal email.`;
  }
  return null;
}
