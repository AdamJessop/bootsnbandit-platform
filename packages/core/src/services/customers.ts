import type { Customer, Prisma } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import {
  DuplicateContactError,
  findOrCreateCustomer,
  isUniqueViolation,
  normaliseEmail,
  normalisePhone,
} from "./contact-identity";

/**
 * Customer (CRM) service — directory + find-or-create used by enquiry/flash
 * lead capture so a public submission is tied to a Customer row.
 */

export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  marketingConsent?: boolean;
  tags?: string[];
}

/**
 * Create a customer with normalised contact details. Email and phone are
 * unique at the database, so a clash raises DuplicateContactError rather than
 * a raw P2002 — callers surface `err.message` to staff.
 */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  try {
    return await prisma.customer.create({
      data: {
        name: input.name,
        email: normaliseEmail(input.email),
        phone: normalisePhone(input.phone),
        notes: input.notes ?? null,
        marketingConsent: input.marketingConsent ?? false,
        tags: input.tags ?? [],
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateContactError();
    throw err;
  }
}

/**
 * Find an existing customer by normalised email (preferred) or phone,
 * otherwise create one. Used by public enquiry/flash flows and the front-desk
 * walk-in path where the visitor isn't authenticated.
 *
 * Thin alias for `findOrCreateCustomer` (services/contact-identity), which
 * owns normalisation, the identity handles and the no-mutation guard: a match
 * is returned UNMUTATED so a stranger cannot overwrite an existing customer's
 * email/phone/marketingConsent by matching on the other field.
 */
export async function upsertCustomerByContact(
  input: CreateCustomerInput,
): Promise<Customer> {
  return findOrCreateCustomer({
    name: input.name,
    email: input.email,
    phone: input.phone,
    marketingConsent: input.marketingConsent,
    notes: input.notes,
    tags: input.tags,
  });
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } });
}

export interface ListCustomersInput {
  search?: string;
  take?: number;
  skip?: number;
  /**
   * Scope to customers who have at least one Booking with this artist. Used to
   * limit non-OWNER staff to their own clients (PII over-exposure guard).
   */
  artistId?: string;
}

export async function listCustomers(
  input: ListCustomersInput = {},
): Promise<Customer[]> {
  const { search, take = 50, skip = 0, artistId } = input;
  const filters: Prisma.CustomerWhereInput[] = [];
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    });
  }
  if (artistId) {
    filters.push({ bookings: { some: { artistId } } });
  }
  const where: Prisma.CustomerWhereInput = filters.length
    ? { AND: filters }
    : {};
  return prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  marketingConsent?: boolean;
  tags?: string[];
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const data: Prisma.CustomerUpdateInput = { ...input };
  if ("email" in input) data.email = normaliseEmail(input.email);
  if ("phone" in input) data.phone = normalisePhone(input.phone);
  try {
    return await prisma.customer.update({ where: { id }, data });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateContactError();
    throw err;
  }
}
