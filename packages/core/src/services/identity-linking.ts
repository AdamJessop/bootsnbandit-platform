import type { Prisma } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import type { IdentityChannel } from "./contact-identity";
import { mergedFields } from "./customer-merge-plan";

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
 *
 * Field-merging is `customer-merge-plan`'s `mergedFields`, unchanged — this is
 * the same operation the duplicate-customer merge performs, so it must not
 * grow a second, quietly different set of rules.
 */

/** No email, no phone, no login, no bookings — nothing but the handle. */
const STUB_CUSTOMER = {
  email: null,
  phone: null,
  passwordHash: null,
  bookings: { none: {} },
} as const;

/** Exactly customer-merge's SELECT: every column `mergedFields` reads. */
const MERGE_SELECT = {
  id: true,
  createdAt: true,
  name: true,
  email: true,
  phone: true,
  notes: true,
  tags: true,
  marketingConsent: true,
  loyaltyStamps: true,
  loyaltyTier: true,
  passwordHash: true,
  dob: true,
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
 *
 * `excludeCustomerId` drops the handles the customer being viewed already
 * owns; offering someone their own handle is an invitation to a no-op.
 */
export async function listLinkableIdentities(
  options: { excludeCustomerId?: string; limit?: number } = {},
): Promise<LinkableIdentity[]> {
  const rows = await prisma.customerIdentity.findMany({
    where: {
      customer: STUB_CUSTOMER,
      ...(options.excludeCustomerId
        ? { customerId: { not: options.excludeCustomerId } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
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
const CUSTOMER_GONE = "That customer no longer exists.";
const OWNER_IS_REAL =
  "That handle already belongs to a customer with their own contact details or bookings — merge those records instead.";
const HANDLE_TAKEN =
  "That handle was just linked to a different customer — refresh and try again.";

/**
 * The stub stopped being a stub between the re-read and the delete — almost
 * always a booking taken mid-merge. Thrown to roll the transaction back.
 */
export class StubChangedError extends Error {
  constructor() {
    super("That handle's owner stopped being an empty record mid-merge.");
    this.name = "StubChangedError";
  }
}

export type IdentityMoveOutcome =
  | { kind: "moved"; movedEnquiries: number; movedMessages: number }
  | { kind: "not_a_stub" }
  | { kind: "target_missing" };

/**
 * How the absorbed row is named in the survivor's notes. `mergedFields` writes
 * a `[merged <name>]` line for every row it deletes, whether or not that row
 * had notes of its own; this stamps the id and the date into that name, so a
 * deleted stub leaves a trace someone can actually follow back.
 */
function auditLabel(stub: { id: string; name: string }): string {
  const name = stub.name.trim() || "Messenger user";
  return `${name} (${stub.id}) on ${new Date().toISOString()}`;
}

/**
 * The whole move, as one transaction body. Exported because this is where the
 * safety of the operation lives and it has to be testable on its own: every
 * read the decision rests on happens inside `tx`, and the stub is removed with
 * a PREDICATE-GUARDED `deleteMany` rather than a `delete` by id.
 *
 * That guard is the point. `Booking` cascades from `Customer`, and `Session`
 * and the consent form cascade from `Booking` — so deleting a row that has
 * quietly stopped being a stub would take a real appointment with it. Checking
 * the predicate before the transaction cannot prevent that; checking it as
 * part of the delete can, because a delete that matches nothing throws here
 * and rolls back every move above it.
 */
export async function applyIdentityMove(
  tx: Prisma.TransactionClient,
  input: { stubOwnerId: string; targetId: string },
): Promise<IdentityMoveOutcome> {
  const stub = await tx.customer.findFirst({
    where: { id: input.stubOwnerId, ...STUB_CUSTOMER },
    select: MERGE_SELECT,
  });
  if (!stub) return { kind: "not_a_stub" };

  // The target is read HERE, not before the transaction: its notes and tags
  // are about to be rewritten from this copy, and a copy fetched earlier
  // could silently undo a `saveCustomerNotes` that landed in between.
  const target = await tx.customer.findUnique({
    where: { id: input.targetId },
    select: MERGE_SELECT,
  });
  if (!target) return { kind: "target_missing" };

  const move = {
    where: { customerId: stub.id },
    data: { customerId: target.id },
  };
  // The same FK set as customer-merge's applyMergeGroup, less `booking` —
  // the stub predicate guarantees there are none. (`EnquiryRead` is keyed by
  // enquiry + user and carries no customer, so reads follow their enquiry.)
  const enquiries = await tx.enquiry.updateMany(move);
  const messages = await tx.enquiryMessage.updateMany(move);
  await tx.messageLog.updateMany(move);
  await tx.review.updateMany(move);
  await tx.customerPasswordToken.updateMany(move);
  await tx.customerIdentity.updateMany(move);

  // Consent (OR), tags (union), stamps (sum), tier (max), dob (coalesce) and
  // the notes — including the `[merged …]` audit line — all come from the
  // shared planner. Name, email and phone are deliberately NOT written back:
  // a stub has neither by definition, so there is nothing to merge into them,
  // and re-writing the target's own contact columns here could only do harm.
  const fields = mergedFields(target, [{ ...stub, name: auditLabel(stub) }]);
  await tx.customer.update({
    where: { id: target.id },
    data: {
      notes: fields.notes,
      tags: fields.tags,
      marketingConsent: fields.marketingConsent,
      loyaltyStamps: fields.loyaltyStamps,
      loyaltyTier: fields.loyaltyTier,
      dob: fields.dob,
    },
  });

  const removed = await tx.customer.deleteMany({
    where: { id: stub.id, ...STUB_CUSTOMER },
  });
  if (removed.count !== 1) throw new StubChangedError();

  return {
    kind: "moved",
    movedEnquiries: enquiries.count,
    movedMessages: messages.count,
  };
}

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
    select: { id: true, customerId: true },
  });
  if (!identity) {
    return { ok: false, reason: "identity_missing", message: IDENTITY_GONE };
  }
  if (identity.customerId === input.customerId) {
    // Idempotent: two clicks, or two people clicking, is not an error.
    return { ok: true, merged: false, movedEnquiries: 0, movedMessages: 0 };
  }

  try {
    const outcome = await prisma.$transaction((tx) =>
      applyIdentityMove(tx, {
        stubOwnerId: identity.customerId,
        targetId: input.customerId,
      }),
    );
    if (outcome.kind === "target_missing") {
      return { ok: false, reason: "customer_missing", message: CUSTOMER_GONE };
    }
    if (outcome.kind === "not_a_stub") {
      // Either the owner really is a real customer, or a concurrent link took
      // the handle (and deleted the stub) a moment ago. Only the second
      // reading deserves a "someone beat you to it" message.
      return (
        (await raceOutcome(
          input.identityId,
          input.customerId,
          identity.customerId,
        )) ?? { ok: false, reason: "in_use", message: OWNER_IS_REAL }
      );
    }
    return {
      ok: true,
      merged: true,
      movedEnquiries: outcome.movedEnquiries,
      movedMessages: outcome.movedMessages,
    };
  } catch (err) {
    // The transaction rolled back whole, so nothing here changed. Say what
    // actually happened rather than surfacing a Prisma error: a concurrent
    // link that beat us to the handle, or a stub that stopped being one.
    const raced = await raceOutcome(
      input.identityId,
      input.customerId,
      identity.customerId,
    );
    if (raced) return raced;
    if (err instanceof StubChangedError) {
      return { ok: false, reason: "in_use", message: OWNER_IS_REAL };
    }
    // Not a race and not the guard — a real failure, and it must not be
    // dressed up as one.
    throw err;
  }
}
