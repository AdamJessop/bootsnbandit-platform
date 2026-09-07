import { Prisma } from "@prisma/client";
import type { Enquiry, EnquirySource, EnquiryStatus } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { upsertCustomerByContact } from "./customers";
import { attachMoodboardAssets } from "./moodboard-assets";

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
  moodboardData?: Prisma.InputJsonValue | null;
  assetIds?: string[];
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
      moodboardData: input.moodboardData ?? Prisma.DbNull,
      source: input.source ?? "web",
      status: input.status ?? "new",
    },
  });

  if (input.assetIds?.length) {
    const attached = await attachMoodboardAssets(enquiry.id, input.assetIds);
    if (attached < input.assetIds.length) {
      console.warn(
        `Enquiry ${enquiry.id}: attached ${attached} of ${input.assetIds.length} mood-board assets`,
      );
    }
  }

  // Acknowledge the enquiry by email when we have an address. The template
  // consumes { customerName, artistName, subjectIdea } — map our fields to it.
  if (input.contactEmail) {
    let artistName: string | undefined;
    if (input.preferredArtistId) {
      const artist = await prisma.artist.findUnique({
        where: { id: input.preferredArtistId },
        select: { name: true },
      });
      artistName = artist?.name;
    }
    await sendEmail({
      to: input.contactEmail,
      type: "enquiry_ack",
      customerId: customer.id,
      data: {
        customerName: input.contactName,
        artistName,
        subjectIdea: input.description ?? input.style ?? undefined,
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
