import type { Customer, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  return prisma.customer.create({
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      marketingConsent: input.marketingConsent ?? false,
      tags: input.tags ?? [],
    },
  });
}

/**
 * Find an existing customer by email (preferred) or phone, otherwise create
 * one. When a match is found, fills in any newly-supplied contact fields.
 * Used by public enquiry/flash flows where the visitor isn't authenticated.
 */
export async function upsertCustomerByContact(
  input: CreateCustomerInput,
): Promise<Customer> {
  const or: Prisma.CustomerWhereInput[] = [];
  if (input.email) or.push({ email: input.email });
  if (input.phone) or.push({ phone: input.phone });

  const existing = or.length
    ? await prisma.customer.findFirst({ where: { OR: or } })
    : null;

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        email: input.email ?? existing.email,
        phone: input.phone ?? existing.phone,
        marketingConsent: input.marketingConsent ?? existing.marketingConsent,
      },
    });
  }

  return createCustomer(input);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } });
}

export interface ListCustomersInput {
  search?: string;
  take?: number;
  skip?: number;
}

export async function listCustomers(
  input: ListCustomersInput = {},
): Promise<Customer[]> {
  const { search, take = 50, skip = 0 } = input;
  const where: Prisma.CustomerWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      }
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
  return prisma.customer.update({ where: { id }, data: input });
}
