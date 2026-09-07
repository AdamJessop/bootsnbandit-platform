import { Prisma } from "@prisma/client";
import type {
  Enquiry,
  EnquiryChannel,
  EnquirySource,
  EnquiryStatus,
} from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { findOrCreateCustomer } from "./contact-identity";
import { recordInbound } from "./enquiry-messages";
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
  channel?: EnquiryChannel;
  status?: EnquiryStatus;
  marketingConsent?: boolean;
}

/** The three public forms map one-to-one onto the matching channel. */
export function channelForSource(source: EnquirySource): EnquiryChannel {
  return source as EnquiryChannel;
}

function poundsFromPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * The customer's own words become the first message on the thread. When the
 * form carried no description, summarise the structured brief instead so the
 * thread is never an empty bubble.
 */
export function enquiryBriefText(
  input: Pick<
    CreateEnquiryInput,
    "description" | "style" | "placement" | "size" | "budgetPence"
  >,
): string {
  const described = input.description?.trim();
  if (described) return described;
  const parts: string[] = [];
  if (input.style) parts.push(`Style: ${input.style}`);
  if (input.placement) parts.push(`Placement: ${input.placement}`);
  if (input.size) parts.push(`Size: ${input.size}`);
  if (input.budgetPence != null) {
    parts.push(`Budget: ${poundsFromPence(input.budgetPence)}`);
  }
  return parts.length ? parts.join(" · ") : "(no details given)";
}

/** Short thread title for the inbox list (email threads set their own). */
export function enquirySubject(
  input: Pick<CreateEnquiryInput, "description" | "style">,
): string | null {
  const described = input.description?.trim();
  if (described) return described.slice(0, 120);
  const style = input.style?.trim();
  return style ? style.slice(0, 120) : null;
}

export async function createEnquiry(
  input: CreateEnquiryInput,
): Promise<Enquiry> {
  // Identity first: normalised email/phone are unique, so this is the single
  // place a public submission is bound to a CRM record.
  const customer = await findOrCreateCustomer({
    name: input.contactName,
    email: input.contactEmail ?? null,
    phone: input.contactPhone ?? null,
    marketingConsent: input.marketingConsent,
  });

  const source = input.source ?? "web";
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
      source,
      channel: input.channel ?? channelForSource(source),
      subject: enquirySubject(input),
      status: input.status ?? "new",
    },
  });

  // Every enquiry has a thread from birth: the form submission IS the first
  // inbound message, so the admin thread view has something to show for web
  // leads exactly as it will for email and Meta ones.
  await recordInbound({
    enquiryId: enquiry.id,
    customerId: customer.id,
    channel: "web",
    bodyText: enquiryBriefText(input),
    fromName: input.contactName,
    fromAddress: customer.email ?? customer.phone ?? null,
    subject: enquiry.subject,
    at: enquiry.createdAt,
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
      enquiryId: enquiry.id,
      data: {
        customerName: input.contactName,
        artistName,
        subjectIdea: input.description ?? input.style ?? undefined,
      },
    });
  }

  // Re-read so the caller sees the timestamps recordInbound set.
  return prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
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
