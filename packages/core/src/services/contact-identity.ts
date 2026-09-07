import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { Customer, CustomerIdentity, Prisma } from "@prisma/client";
import { prisma } from "@bnb/core/db";

/**
 * Customer identity resolution: one CRM record per human, keyed by a
 * normalised email and/or phone (both unique in the schema) plus per-channel
 * external ids (Messenger PSID / Instagram IGSID) that carry no contact
 * details at all.
 *
 * Normalisation is the whole point of the unique indexes — "Amy@X.com" and
 * "amy@x.com", "07700 900123" and "+447700900123" must collapse to one row.
 */

/** The studio is in the UK; bare national numbers are read as GB. */
export const PHONE_DEFAULT_REGION = "GB";

/**
 * Lowercase + trim. Deliberately does NOT strip dots or plus-addressing:
 * `amy+ink@example.com` is a mailbox the customer chose and may be a different
 * person's alias elsewhere. Returns null for anything that is not shaped like
 * an address so junk never occupies the unique index.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Parse to E.164 with a GB default region. Returns null when the number is
 * missing or cannot be parsed as a plausible number — callers keep the raw
 * value out of the unique column rather than storing an un-matchable string.
 *
 * Uses `isPossible()` rather than `isValid()`: the latter checks against
 * real allocated ranges, which excludes Ofcom's 07700 900xxx block reserved
 * for fiction/drama use (a number several enquiry forms and QA fixtures use)
 * even though it is structurally a correct UK mobile number. `isPossible()`
 * still rejects genuine junk like "12345" (too short) or unparseable text.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, PHONE_DEFAULT_REGION);
  return parsed?.isPossible() ? parsed.number : null;
}

/** Channels whose users are known by an opaque handle rather than contact details. */
export type IdentityChannel = "messenger" | "instagram";

export interface ContactIdentityInput {
  channel: IdentityChannel;
  externalId: string;
  displayName?: string | null;
}

export interface FindOrCreateCustomerInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  marketingConsent?: boolean;
  /** Applied ONLY when creating a brand-new customer — never on a match. */
  notes?: string | null;
  /** Applied ONLY when creating a brand-new customer — never on a match. */
  tags?: string[];
  identity?: ContactIdentityInput | null;
}

/** Best available human-readable name, never blank (the column is required). */
export function displayNameFor(input: {
  name?: string | null;
  email?: string | null;
  identity?: ContactIdentityInput | null;
}): string {
  const given = input.name?.trim();
  if (given) return given;
  const fromIdentity = input.identity?.displayName?.trim();
  if (fromIdentity) return fromIdentity;
  const email = normaliseEmail(input.email);
  if (email) return email.split("@")[0];
  return "Customer";
}

/**
 * Attach a channel handle to a customer. Idempotent: re-linking the same
 * handle refreshes the display name instead of failing the unique index.
 */
export async function linkIdentity(
  customerId: string,
  channel: IdentityChannel,
  externalId: string,
  displayName?: string | null,
): Promise<CustomerIdentity> {
  return prisma.customerIdentity.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { customerId, channel, externalId, displayName: displayName ?? null },
    update: displayName ? { displayName } : {},
  });
}

/**
 * Resolve the one CRM record for a person: by channel handle first (Meta users
 * have no contact details), then by normalised email or phone, otherwise a new
 * row with normalised values.
 *
 * SECURITY: an existing match is returned UNMUTATED — the public enquiry paths
 * call this, so writing contact/consent onto a match would let a stranger take
 * over a record by matching on the other field. Only the identity link is
 * added to a match, because a channel handle is proof of that account.
 */
export async function findOrCreateCustomer(
  input: FindOrCreateCustomerInput,
): Promise<Customer> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  const identity = input.identity ?? null;

  if (identity) {
    const link = await prisma.customerIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: identity.channel,
          externalId: identity.externalId,
        },
      },
      select: { customer: true },
    });
    if (link) return link.customer;
  }

  const or: Prisma.CustomerWhereInput[] = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  const existing = or.length
    ? await prisma.customer.findFirst({
        where: { OR: or },
        orderBy: { createdAt: "asc" },
      })
    : null;

  if (existing) {
    if (identity) {
      await linkIdentity(
        existing.id,
        identity.channel,
        identity.externalId,
        identity.displayName,
      );
    }
    return existing;
  }

  const data = {
    name: displayNameFor({ name: input.name, email: input.email, identity }),
    email,
    phone,
    marketingConsent: input.marketingConsent ?? false,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
  };

  let created: Customer;
  try {
    created = await prisma.customer.create({ data });
  } catch (err) {
    // Unique email/phone: a concurrent request won the race — take theirs.
    // Not yet reachable in practice — Customer.email/phone have no unique
    // constraint until Task 5 adds them; the findFirst above is the only
    // guard for now, and this branch becomes live once that lands.
    if (isUniqueViolation(err) && or.length) {
      const winner = await prisma.customer.findFirst({
        where: { OR: or },
        orderBy: { createdAt: "asc" },
      });
      if (!winner) throw err;
      created = winner;
    } else {
      throw err;
    }
  }

  if (identity) {
    await linkIdentity(
      created.id,
      identity.channel,
      identity.externalId,
      identity.displayName,
    );
  }
  return created;
}

/** Prisma's P2002 (unique constraint) without importing the error class. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/** A write hit the unique email/phone index — surfaced with a readable message. */
export class DuplicateContactError extends Error {
  constructor(message = "A customer with that email or phone already exists.") {
    super(message);
    this.name = "DuplicateContactError";
  }
}
