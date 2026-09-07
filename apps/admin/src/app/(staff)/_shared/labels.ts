/**
 * Shared label + date helpers for the back-of-house screens (P10). Pure so they
 * unit-test in the node environment.
 */
import type { BookingStatus, EnquiryStatus, LeaveStatus } from "@prisma/client";

export function bookingStatusLabel(status: BookingStatus): string {
  const map: Record<BookingStatus, string> = {
    enquiry: "Enquiry",
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
  };
  return map[status] ?? status;
}

/** shadcn Badge variant per booking status. */
export function bookingStatusVariant(
  status: BookingStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "confirmed":
    case "completed":
      return "default";
    case "cancelled":
    case "no_show":
      return "destructive";
    default:
      return "secondary";
  }
}

export function enquiryStatusLabel(status: EnquiryStatus): string {
  const map: Record<EnquiryStatus, string> = {
    new: "New",
    replied: "Replied",
    customer_replied: "Customer replied",
    converted: "Converted",
    closed: "Closed",
  };
  return map[status] ?? status;
}

export function enquiryStatusVariant(
  status: EnquiryStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new":
      return "default";
    case "converted":
      return "secondary";
    case "closed":
      return "destructive";
    case "customer_replied":
      return "destructive";
    default:
      return "outline";
  }
}

export function leaveStatusLabel(status: LeaveStatus): string {
  const map: Record<LeaveStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[status] ?? status;
}

export function loyaltyTierLabel(tier: number): string {
  return tier > 0 ? `Tier ${tier}` : "—";
}

export interface VisitDates {
  lastVisit: string | null;
  nextVisit: string | null;
}

/**
 * From a list of booking start dates, derive the most recent past visit and
 * the soonest upcoming visit relative to `now` (ms epoch). Pure.
 */
export function deriveVisits(
  starts: (Date | string)[],
  now: number = Date.now(),
): VisitDates {
  let last: number | null = null;
  let next: number | null = null;
  for (const s of starts) {
    const t = new Date(s).getTime();
    if (Number.isNaN(t)) continue;
    if (t <= now) {
      if (last == null || t > last) last = t;
    } else if (next == null || t < next) {
      next = t;
    }
  }
  return {
    lastVisit: last == null ? null : new Date(last).toISOString(),
    nextVisit: next == null ? null : new Date(next).toISOString(),
  };
}

export function formatDay(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
