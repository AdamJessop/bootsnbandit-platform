"use server";

/**
 * Enquiry triage server actions (BACKOFHOUSE-IA E2): reply (emails the
 * customer + logs it), assign an artist, and convert → booking. Non-owners are
 * scoped to enquiries that prefer their artist. Booking conflicts (incl.
 * leave) surface as a 409-style message.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingConflictError, createBooking } from "@/lib/services/bookings";
import { updateEnquiryStatus } from "@/lib/services/enquiries";
import { buildConvertInput, validateReply } from "./enquiry-helpers";
import type { BookingType } from "@prisma/client";

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
    },
  });
  if (user.role !== "OWNER" && enquiry.preferredArtistId !== user.artistId) {
    throw new Error("Forbidden");
  }
  return enquiry;
}

export async function replyToEnquiry(
  enquiryId: string,
  input: { message: string },
): Promise<ActionState> {
  const enquiry = await loadEnquiryScoped(enquiryId);
  const valid = validateReply(input);
  if (!valid.ok) return { ok: false, message: valid.error };
  if (!enquiry.contactEmail) {
    return { ok: false, message: "This enquiry has no email to reply to." };
  }

  // Free-form reply: record on the customer timeline + mark the enquiry replied.
  await prisma.messageLog.create({
    data: {
      customerId: enquiry.customerId,
      type: "enquiry_ack",
      channel: "email",
      subject: "Re: your enquiry",
      body: valid.message,
      status: "logged",
      sentAt: new Date(),
    },
  });
  await updateEnquiryStatus(enquiryId, "replied");

  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Reply logged and enquiry marked replied." };
}

export async function assignEnquiry(
  enquiryId: string,
  artistId: string,
): Promise<ActionState> {
  await loadEnquiryScoped(enquiryId);
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { preferredArtistId: artistId || null },
  });
  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Artist assigned." };
}

export async function closeEnquiry(enquiryId: string): Promise<ActionState> {
  await loadEnquiryScoped(enquiryId);
  await updateEnquiryStatus(enquiryId, "closed");
  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Enquiry closed." };
}

export async function convertEnquiry(
  enquiryId: string,
  form: { artistId: string; startISO: string; durationMin: number; type: BookingType },
): Promise<ActionState> {
  const user = await requireRole();
  const enquiry = await loadEnquiryScoped(enquiryId);
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
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/bookings");
  return { ok: true, message: "Converted to a pending booking." };
}
