/**
 * STUB — Unified customer history timeline (BACKOFHOUSE-IA F2). Wave-4 phase
 * P10 renders enquiries, bookings, sessions and emails-sent in one stream.
 * Prop interface is the stable contract.
 */

export interface TimelineEntry {
  id: string;
  kind: "enquiry" | "booking" | "session" | "email" | "note" | "loyalty";
  /** ISO timestamp. */
  at: string;
  title: string;
  detail?: string;
  /** e.g. email delivery status. */
  status?: string;
}

export interface CustomerTimelineProps {
  customerId: string;
  entries: TimelineEntry[];
}

export function CustomerTimeline({ entries }: CustomerTimelineProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-6 text-text-muted">
      <p className="font-termina text-sm uppercase tracking-wide text-text-primary">
        Customer timeline
      </p>
      <p className="mt-1 text-sm">
        {entries.length} entr(ies). Timeline implementation lands in Phase 10.
      </p>
    </div>
  );
}
