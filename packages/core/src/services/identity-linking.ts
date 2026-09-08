import { prisma } from "@bnb/core/db";
import type { IdentityChannel } from "./contact-identity";

/**
 * Attach a Messenger/Instagram handle to an existing customer, folding away
 * the stub record the handle's first message created.
 *
 * The failure this repairs: a customer we already know by email sends an
 * Instagram DM. The DM carries no email and no phone, so `findOrCreateCustomer`
 * has nothing to match on and correctly creates a second record — correctly,
 * because guessing would let a stranger claim someone else's history. Only a
 * human can say "these are the same person", and this is where they say it.
 *
 * A stub is a record with no email, no phone, no password and no bookings:
 * everything it holds arrived through the handle itself, so moving it moves
 * nothing that was ever verified against another person.
 */

/** No email, no phone, no login, no bookings — nothing but the handle. */
const STUB_CUSTOMER = {
  email: null,
  phone: null,
  passwordHash: null,
  bookings: { none: {} },
} as const;

export interface LinkableIdentity {
  id: string;
  channel: IdentityChannel;
  displayName: string | null;
  customerId: string;
  customerName: string;
  createdAt: Date;
}

/**
 * Handles that could be linked elsewhere: the ones sitting on stub records.
 * A handle on a real customer is never offered — moving it would be taking a
 * verified account away from the person it belongs to.
 */
export async function listLinkableIdentities(
  limit = 50,
): Promise<LinkableIdentity[]> {
  const rows = await prisma.customerIdentity.findMany({
    where: { customer: STUB_CUSTOMER },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      displayName: true,
      customerId: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    channel: row.channel as IdentityChannel,
    displayName: row.displayName,
    customerId: row.customerId,
    customerName: row.customer.name,
    createdAt: row.createdAt,
  }));
}

export type LinkIdentityResult =
  | { ok: true; merged: boolean; movedEnquiries: number; movedMessages: number }
  | {
      ok: false;
      reason: "identity_missing" | "customer_missing" | "in_use";
      message: string;
    };

const IDENTITY_GONE = "That handle no longer exists — refresh and try again.";
const OWNER_IS_REAL =
  "That handle already belongs to a customer with their own contact details or bookings — merge those records instead.";
const HANDLE_TAKEN =
  "That handle was just linked to a different customer — refresh and try again.";

/**
 * Did somebody else move this handle while we were working? Two owners can
 * open the same list and click the same row, and the loser's reads are stale
 * by the time it writes.
 *
 * Returns the result to hand back when the handle has moved, or null when it
 * is exactly where we last saw it — in which case whatever went wrong was not
 * a race, and the caller's own explanation stands.
 */
async function raceOutcome(
  identityId: string,
  targetId: string,
  seenOwnerId: string,
): Promise<LinkIdentityResult | null> {
  const now = await prisma.customerIdentity.findUnique({
    where: { id: identityId },
    select: { customerId: true },
  });
  if (!now) {
    return { ok: false, reason: "identity_missing", message: IDENTITY_GONE };
  }
  if (now.customerId === seenOwnerId) return null;
  if (now.customerId === targetId) {
    // The other owner asked for exactly what we were asking for, and got
    // there first. Their work is our answer.
    return { ok: true, merged: false, movedEnquiries: 0, movedMessages: 0 };
  }
  return { ok: false, reason: "in_use", message: HANDLE_TAKEN };
}

export async function linkIdentityToCustomer(input: {
  identityId: string;
  customerId: string;
}): Promise<LinkIdentityResult> {
  const identity = await prisma.customerIdentity.findUnique({
    where: { id: input.identityId },
    select: { id: true, customerId: true, displayName: true },
  });
  if (!identity) {
    return { ok: false, reason: "identity_missing", message: IDENTITY_GONE };
  }
  const target = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, notes: true },
  });
  if (!target) {
    return {
      ok: false,
      reason: "customer_missing",
      message: "That customer no longer exists.",
    };
  }
  if (identity.customerId === target.id) {
    // Idempotent: two clicks, or two people clicking, is not an error.
    return { ok: true, merged: false, movedEnquiries: 0, movedMessages: 0 };
  }

  // Re-read the current owner THROUGH the stub predicate: the check and the
  // decision are then the same query, so a booking taken between them cannot
  // slip a real customer into the merge.
  const stub = await prisma.customer.findFirst({
    where: { id: identity.customerId, ...STUB_CUSTOMER },
    select: { id: true, name: true, notes: true },
  });
  if (!stub) {
    // Either the owner really is a real customer, or a concurrent link took
    // the handle (and deleted the stub) a moment ago. Only the second reading
    // deserves a "someone beat you to it" message.
    return (
      (await raceOutcome(input.identityId, target.id, identity.customerId)) ?? {
        ok: false,
        reason: "in_use",
        message: OWNER_IS_REAL,
      }
    );
  }

  const move = {
    where: { customerId: stub.id },
    data: { customerId: target.id },
  };
  // Same FK set as customer-merge's applyMergeGroup, in one transaction: the
  // stub must not be deleted while anything still points at it, and a half
  // done move would strand a thread on a record that no longer exists.
  try {
    const [enquiries, messages] = await prisma.$transaction([
      prisma.enquiry.updateMany(move),
      prisma.enquiryMessage.updateMany(move),
      prisma.messageLog.updateMany(move),
      prisma.review.updateMany(move),
      prisma.customerPasswordToken.updateMany(move),
      prisma.customerIdentity.updateMany(move),
      prisma.customer.update({
        where: { id: target.id },
        data: {
          // Whatever an owner typed on the stub is the only thing on it that a
          // human wrote; keep it rather than deleting it with the row.
          notes:
            [target.notes?.trim(), stub.notes?.trim()]
              .filter(Boolean)
              .join("\n") || null,
        },
      }),
      prisma.customer.delete({ where: { id: stub.id } }),
    ]);

    return {
      ok: true,
      merged: true,
      movedEnquiries: enquiries.count,
      movedMessages: messages.count,
    };
  } catch (err) {
    // A concurrent link committed between our stub read and our write, so the
    // delete found nothing (P2025) or the two transactions deadlocked. Either
    // way the whole thing rolled back and nothing here changed — report where
    // the handle actually ended up. If it has not moved at all this was a real
    // failure, not a race, and must not be dressed up as one.
    const raced = await raceOutcome(
      input.identityId,
      target.id,
      identity.customerId,
    );
    if (raced) return raced;
    throw err;
  }
}
