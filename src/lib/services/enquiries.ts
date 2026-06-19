import { Prisma } from "@prisma/client";
import type { Enquiry, EnquirySource, EnquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { upsertCustomerByContact } from "./customers";

/**
 * Enquiries — public lead capture from the Enquire form (web), flash claims
 * (flash) and the Inkling style matcher (inkling).
 *
 * Each enquiry is tied to a Customer (find-or-create by contact) and triggers
 * an enquiry-ack email when we have an address to send to.
 */

export interface CreateEnquiryInput {
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  preferredArtistId?: string | null;
  style?: string | null;
  placement?: string | null;
  size?: string | null;
  budgetPence?: number | null;
  description?: string | null;
  moodboard?: string[];
  matchData?: Prisma.InputJsonValue | null;
  source?: EnquirySource;
  status?: EnquiryStatus;
  marketingConsent?: boolean;
}

export async function createEnquiry(
  input: CreateEnquiryInput,
): Promise<Enquiry> {
  const customer = await upsertCustomerByContact({
    name: input.contactName,
    email: input.contactEmail ?? null,
    phone: input.contactPhone ?? null,
    marketingConsent: input.marketingConsent,
  });

  const enquiry = await prisma.enquiry.create({
    data: {
      customerId: customer.id,
      contactName: input.contactName,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      preferredArtistId: input.preferredArtistId ?? null,
      style: input.style ?? null,
      placement: input.placement ?? null,
      size: input.size ?? null,
      budgetPence: input.budgetPence ?? null,
      description: input.description ?? null,
      moodboard: input.moodboard ?? [],
      matchData: input.matchData ?? Prisma.DbNull,
      source: input.source ?? "web",
      status: input.status ?? "new",
    },
  });

  // Acknowledge the enquiry by email when we have an address.
  if (input.contactEmail) {
    await sendEmail({
      to: input.contactEmail,
      type: "enquiry_ack",
      customerId: customer.id,
      data: {
        contactName: input.contactName,
        style: input.style ?? null,
        source: enquiry.source,
      },
    });
  }

  return enquiry;
}

export async function getEnquiry(id: string): Promise<Enquiry | null> {
  return prisma.enquiry.findUnique({ where: { id } });
}

export interface ListEnquiriesInput {
  status?: EnquiryStatus;
  source?: EnquirySource;
  preferredArtistId?: string;
  take?: number;
  skip?: number;
}

export async function listEnquiries(
  input: ListEnquiriesInput = {},
): Promise<Enquiry[]> {
  const { status, source, preferredArtistId, take = 100, skip = 0 } = input;
  return prisma.enquiry.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(preferredArtistId ? { preferredArtistId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
}

export async function updateEnquiryStatus(
  id: string,
  status: EnquiryStatus,
): Promise<Enquiry> {
  return prisma.enquiry.update({ where: { id }, data: { status } });
}
