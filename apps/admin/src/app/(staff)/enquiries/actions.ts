"use server";

/**
 * Enquiry triage server actions (BACKOFHOUSE-IA E2): reply (emails the
 * customer + logs it), assign an artist, and convert → booking. Non-owners are
 * scoped to enquiries that prefer their artist. Booking conflicts (incl.
 * leave) surface as a 409-style message.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import {
  BookingConflictError,
  createBooking,
} from "@bnb/core/services/bookings";
import { updateEnquiryStatus } from "@bnb/core/services/enquiries";
import {
  markRead,
  recordNote,
  recordOutbound,
} from "@bnb/core/services/enquiry-messages";
import {
  buildConvertInput,
  canAccessEnquiry,
  canCloseEnquiry,
  isUnassigned,
  validateReply,
} from "./enquiry-helpers";
import type { BookingType } from "@prisma/client";
import type { SessionUser } from "@bnb/core/auth";

export interface ActionState {
  ok: boolean;
  message?: string;
}

async function loadEnquiryScoped(enquiryId: string) {
  const user = await requireRole();
  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { id: enquiryId },
    select: {
      id: true,
      customerId: true,
      contactEmail: true,
      contactName: true,
      preferredArtistId: true,
      style: true,
      placement: true,
      source: true,
      status: true,
    },
  });
  if (!canAccessEnquiry(user, enquiry)) {
    throw new Error("Forbidden");
  }
  return { user, enquiry };
}

/**
 * An artist responding to an unassigned enquiry takes it — on any channel, not
 * just Inkling boards. The claim is conditional at the database
 * (`preferredArtistId: null` in the `where`) so two concurrent claimants can't
 * both "win" a TOCTOU race — only one `updateMany` matches a row.
 */
async function claimIfUnassigned(
  user: SessionUser,
  enquiry: { id: string; preferredArtistId: string | null },
): Promise<{ attempted: boolean; claimed: boolean }> {
  if (user.role === "OWNER" || !user.artistId || !isUnassigned(enquiry)) {
    return { attempted: false, claimed: false };
  }
  const { count } = await prisma.enquiry.updateMany({
    where: { id: enquiry.id, preferredArtistId: null },
    data: { preferredArtistId: user.artistId, assignedAt: new Date() },
  });
  return { attempted: true, claimed: count > 0 };
}

/** Append a note when a reply's implicit claim lost the race. */
function withClaimNote(
  message: string,
  claim: { attempted: boolean; claimed: boolean },
): string {
  return claim.attempted && !claim.claimed
    ? `${message} This enquiry was taken by another artist a moment ago.`
    : message;
}

export async function replyToEnquiry(
  enquiryId: string,
  input: { message: string },
): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  const valid = validateReply(input);
  if (!valid.ok) return { ok: false, message: valid.error };

  if (!enquiry.contactEmail) {
    // No email on file — record the reply on the timeline only.
    await prisma.messageLog.create({
      data: {
        customerId: enquiry.customerId,
        type: "staff_reply",
        channel: "email",
        subject: "Re: your enquiry",
        body: valid.message,
        status: "logged",
        sentAt: null,
      },
    });
    // Also put it on the enquiry thread; sendEmail does this for real sends.
    await recordOutbound({
      enquiryId,
      customerId: enquiry.customerId,
      channel: "email",
      subject: "Re: your enquiry",
      bodyText: valid.message,
      authorUserId: user.id,
      deliveryStatus: "logged",
    });
    await updateEnquiryStatus(enquiryId, "replied");
    const claim = await claimIfUnassigned(user, enquiry);
    revalidatePath("/enquiries");
    return {
      ok: true,
      message: withClaimNote(
        "No email on file — reply logged to the timeline (not sent).",
        claim,
      ),
    };
  }

  // Send the branded staff-reply email; sendEmail writes the MessageLog row
  // itself (sent / logged / failed), so no extra log here.
  const result = await sendEmail({
    to: enquiry.contactEmail,
    type: "staff_reply",
    customerId: enquiry.customerId,
    enquiryId,
    // Attribute the thread message sendEmail records to the replying staffer.
    authorUserId: user.id,
    data: {
      customerName: enquiry.contactName,
      body: valid.message,
    },
  });
  if (result.status === "failed") {
    return {
      ok: false,
      message: "The reply email failed to send — check the email integration.",
    };
  }
  await updateEnquiryStatus(enquiryId, "replied");
  const claim = await claimIfUnassigned(user, enquiry);

  revalidatePath("/enquiries");
  return {
    ok: true,
    message: withClaimNote(
      result.status === "sent"
        ? "Reply emailed to the customer and enquiry marked replied."
        : "Reply logged (email delivery not configured) and enquiry marked replied.",
      claim,
    ),
  };
}

export async function claimEnquiry(enquiryId: string): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  if (!user.artistId) {
    return { ok: false, message: "Only artists can take a board." };
  }
  if (!isUnassigned(enquiry)) {
    return { ok: false, message: "This enquiry has already been taken." };
  }
  // Conditional on `preferredArtistId: null` at the database so a concurrent
  // claim can't both "win" — only the first updateMany matches a row.
  const { count } = await prisma.enquiry.updateMany({
    where: { id: enquiryId, preferredArtistId: null },
    data: { preferredArtistId: user.artistId, assignedAt: new Date() },
  });
  if (count === 0) {
    return { ok: false, message: "This enquiry has already been taken." };
  }
  revalidatePath("/enquiries");
  return {
    ok: true,
    message: "This enquiry is yours — it now shows under your enquiries.",
  };
}

export async function assignEnquiry(
  enquiryId: string,
  artistId: string,
): Promise<ActionState> {
  const { user } = await loadEnquiryScoped(enquiryId);
  // Non-owners may only assign an enquiry to themselves — otherwise a direct
  // action call would let an artist hand an open board to any artist id.
  if (user.role !== "OWNER" && artistId !== user.artistId) {
    return {
      ok: false,
      message: "You can only assign enquiries to yourself.",
    };
  }
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      preferredArtistId: artistId || null,
      assignedAt: artistId ? new Date() : null,
    },
  });
  revalidatePath("/enquiries");
  return { ok: true, message: "Artist assigned." };
}

export async function closeEnquiry(enquiryId: string): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  // Access lets an artist SEE unassigned enquiries; closing is narrower, or one
  // artist could bin a lead another was about to take.
  if (!canCloseEnquiry(user, enquiry)) {
    return {
      ok: false,
      message: "Only the assigned artist (or an owner) can close this enquiry.",
    };
  }
  await updateEnquiryStatus(enquiryId, "closed");
  revalidatePath("/enquiries");
  return { ok: true, message: "Enquiry closed." };
}

/** A staff-only note on the thread. Never sent to the customer. */
export async function addInternalNote(
  enquiryId: string,
  input: { body: string },
): Promise<ActionState> {
  const { user } = await loadEnquiryScoped(enquiryId);
  const body = input.body.trim();
  if (!body) return { ok: false, message: "A note needs some text." };
  await recordNote({ enquiryId, authorUserId: user.id, bodyText: body });
  revalidatePath("/enquiries");
  return { ok: true, message: "Note added." };
}

/** Clear this user's unread flag for the thread (called when it is opened). */
export async function markEnquiryRead(enquiryId: string): Promise<ActionState> {
  const { user } = await loadEnquiryScoped(enquiryId);
  await markRead(enquiryId, user.id);
  revalidatePath("/enquiries");
  return { ok: true };
}

export async function convertEnquiry(
  enquiryId: string,
  form: {
    artistId: string;
    startISO: string;
    durationMin: number;
    type: BookingType;
  },
): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  if (!enquiry.customerId) {
    return { ok: false, message: "This enquiry has no linked customer." };
  }
  // Non-owners may only convert to a booking for themselves.
  if (user.role !== "OWNER" && form.artistId !== user.artistId) {
    return { ok: false, message: "You can only convert to your own bookings." };
  }

  const built = buildConvertInput({
    customerId: enquiry.customerId,
    artistId: form.artistId,
    startISO: form.startISO,
    durationMin: form.durationMin,
    type: form.type,
    style: enquiry.style,
    placement: enquiry.placement,
    enquiryId,
  });
  if (!built.ok) return { ok: false, message: built.error };

  try {
    await createBooking(built.input);
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  await updateEnquiryStatus(enquiryId, "converted");
  revalidatePath("/enquiries");
  revalidatePath("/bookings");
  return { ok: true, message: "Converted to a pending booking." };
}
