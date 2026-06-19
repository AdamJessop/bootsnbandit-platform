import type { Enquiry, Flash } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { createEnquiry } from "./enquiries";

/**
 * Flash claims — a visitor claims a one-off flash design.
 *
 * `claimFlash` atomically reserves one of the available copies (increment
 * `claimed`, retire when sold out) and creates an Enquiry with source=flash so
 * the studio can lock it in. The conditional update (`claimed < total`)
 * prevents over-claiming under concurrency.
 */

export class FlashUnavailableError extends Error {
  constructor(message = "This flash design is no longer available") {
    super(message);
    this.name = "FlashUnavailableError";
  }
}

export interface ClaimFlashInput {
  flashId: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  placement?: string | null;
  marketingConsent?: boolean;
}

export interface ClaimFlashResult {
  flash: Flash;
  enquiry: Enquiry;
}

export async function claimFlash(
  input: ClaimFlashInput,
): Promise<ClaimFlashResult> {
  const flash = await prisma.flash.findUniqueOrThrow({
    where: { id: input.flashId },
  });

  if (flash.status !== "available" || flash.claimed >= flash.total) {
    throw new FlashUnavailableError();
  }

  const nextClaimed = flash.claimed + 1;
  const soldOut = nextClaimed >= flash.total;

  // Conditional update guards against a concurrent claim taking the last copy.
  const { count } = await prisma.flash.updateMany({
    where: { id: flash.id, claimed: flash.claimed, status: "available" },
    data: {
      claimed: nextClaimed,
      status: soldOut ? "claimed" : "available",
    },
  });
  if (count === 0) {
    throw new FlashUnavailableError();
  }

  const updated = await prisma.flash.findUniqueOrThrow({
    where: { id: flash.id },
  });

  const enquiry = await createEnquiry({
    contactName: input.contactName,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    preferredArtistId: flash.artistId ?? null,
    placement: input.placement ?? null,
    description: `Flash claim: ${flash.title}`,
    budgetPence: flash.pricePence ?? null,
    source: "flash",
    marketingConsent: input.marketingConsent,
  });

  return { flash: updated, enquiry };
}

export async function listFlash(activeOnly = false): Promise<Flash[]> {
  return prisma.flash.findMany({
    where: activeOnly ? { status: "available" } : {},
    orderBy: { sortOrder: "asc" },
  });
}
