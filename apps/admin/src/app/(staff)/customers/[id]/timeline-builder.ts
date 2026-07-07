/**
 * Pure transform: fold a customer's enquiries, bookings, sessions and emails
 * (MessageLog) into a single reverse-chronological TimelineEntry[] for the
 * CustomerTimeline component (BACKOFHOUSE-IA F2). Unit-tested in node.
 */
import { formatPence } from "@/components/admin/money";
import type { TimelineEntry } from "@/components/admin/CustomerTimeline";
import { bookingStatusLabel, enquiryStatusLabel } from "../../_shared/labels";
import type { BookingStatus, EnquiryStatus } from "@prisma/client";

export interface TimelineSources {
  enquiries: {
    id: string;
    createdAt: string;
    style: string | null;
    status: EnquiryStatus;
  }[];
  bookings: {
    id: string;
    start: string;
    type: string;
    status: BookingStatus;
    artistName: string;
  }[];
  sessions: {
    id: string;
    completedAt: string;
    amountChargedPence: number;
    tipPence: number | null;
  }[];
  messages: {
    id: string;
    sentAt: string | null;
    createdAt: string;
    type: string;
    status: string;
    subject: string | null;
  }[];
  loyalty: { stamps: number; tier: number };
}

const MESSAGE_TITLE: Record<string, string> = {
  confirmation: "Confirmation email",
  reminder: "Reminder email",
  receipt: "Receipt email",
  aftercare: "Aftercare email",
  review_request: "Review request email",
  enquiry_ack: "Enquiry acknowledgement",
  loyalty_reward: "Loyalty reward email",
};

export function buildTimeline(sources: TimelineSources): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const e of sources.enquiries) {
    entries.push({
      id: `enquiry-${e.id}`,
      kind: "enquiry",
      at: e.createdAt,
      title: e.style ? `Enquiry · ${e.style}` : "Enquiry",
      detail: `Status: ${enquiryStatusLabel(e.status)}`,
    });
  }

  for (const b of sources.bookings) {
    entries.push({
      id: `booking-${b.id}`,
      kind: "booking",
      at: b.start,
      title: `${b.type[0].toUpperCase()}${b.type.slice(1)} with ${b.artistName}`,
      detail: `Status: ${bookingStatusLabel(b.status)}`,
    });
  }

  for (const s of sources.sessions) {
    const tip = s.tipPence ?? 0;
    const detail =
      tip > 0
        ? `${formatPence(s.amountChargedPence)} charged · ${formatPence(tip)} tip`
        : `${formatPence(s.amountChargedPence)} charged`;
    entries.push({
      id: `session-${s.id}`,
      kind: "session",
      at: s.completedAt,
      title: "Session completed",
      detail,
    });
  }

  for (const m of sources.messages) {
    entries.push({
      id: `email-${m.id}`,
      kind: "email",
      at: m.sentAt ?? m.createdAt,
      title: MESSAGE_TITLE[m.type] ?? "Email",
      detail: m.subject ?? undefined,
      status: m.status,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
