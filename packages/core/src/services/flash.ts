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
 *
 * A claim is refused once the drop's `endsAt` has passed, and while the CMS
 * `enquiriesOpen` switch is off — a flash claim is an enquiry, so it closes
 * with the rest of the public funnel.
 *
 * The enquiry's preferred artist is the flash design's artist — a flash piece
 * is tattooed by whoever drew it. Only when the design has no artist does the
 * visitor's own pick (`preferredArtistId`) apply.
 */

export class FlashUnavailableError extends Error {
  constructor(message = "This flash design is no longer available") {
    super(message);
    this.name = "FlashUnavailableError";
  }
}

/** The drop's `endsAt` has passed. */
export class FlashEndedError extends FlashUnavailableError {
  constructor() {
    super(
      "This flash drop has ended — keep an eye on the flash page for the next one.",
    );
    this.name = "FlashEndedError";
  }
}

/** The studio has switched enquiries off (books closed). */
export class FlashClaimsClosedError extends FlashUnavailableError {
  constructor() {
    super(
      "Our books are closed at the moment, so we're not taking flash claims right now. Check back soon.",
    );
    this.name = "FlashClaimsClosedError";
  }
}

/** True while a drop is claimable by time: no end date, or one still ahead. */
export function isFlashLive(
  endsAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return endsAt == null || endsAt.getTime() > now.getTime();
}

export interface ClaimFlashInput {
  flashId: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  placement?: string | null;
  /** Visitor's artist pick; used only when the flash has no artist of its own. */
  preferredArtistId?: string | null;
  marketingConsent?: boolean;
}

export interface ClaimFlashResult {
  flash: Flash;
  enquiry: Enquiry;
}

export async function claimFlash(
  input: ClaimFlashInput,
  now: Date = new Date(),
): Promise<ClaimFlashResult> {
  const settings = await prisma.siteSettings.findFirst({
    select: { enquiriesOpen: true },
  });
  if (settings && !settings.enquiriesOpen) {
    throw new FlashClaimsClosedError();
  }

  const flash = await prisma.flash.findUniqueOrThrow({
    where: { id: input.flashId },
  });

  if (!isFlashLive(flash.endsAt, now)) {
    throw new FlashEndedError();
  }
  if (flash.status !== "available" || flash.claimed >= flash.total) {
    throw new FlashUnavailableError();
  }

  const nextClaimed = flash.claimed + 1;
  const soldOut = nextClaimed >= flash.total;

  // Conditional update guards against a concurrent claim taking the last copy
  // (and against the drop closing between the read and the write).
  const { count } = await prisma.flash.updateMany({
    where: {
      id: flash.id,
      claimed: flash.claimed,
      status: "available",
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
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
    preferredArtistId: flash.artistId ?? input.preferredArtistId ?? null,
    placement: input.placement ?? null,
    description: `Flash claim: ${flash.title}`,
    budgetPence: flash.pricePence ?? null,
    source: "flash",
    marketingConsent: input.marketingConsent,
  });

  return { flash: updated, enquiry };
}

/** Flash designs in display order; `activeOnly` drops claimed and ended ones. */
export async function listFlash(
  activeOnly = false,
  now: Date = new Date(),
): Promise<Flash[]> {
  return prisma.flash.findMany({
    where: activeOnly
      ? {
          status: "available",
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        }
      : {},
    orderBy: { sortOrder: "asc" },
  });
}
