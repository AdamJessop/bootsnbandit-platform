/**
 * Unified customer history timeline (BACKOFHOUSE-IA F2): enquiries, bookings,
 * sessions, emails-sent (MessageLog), notes and loyalty in one reverse-chrono
 * stream. Presentational — the page builds the entries from the domain data.
 * The prop interface is the stable contract.
 */
import {
  CalendarCheck,
  Inbox,
  Mail,
  ReceiptText,
  StarIcon,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

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

/** Sort entries newest-first (pure; unit-tested). */
export function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

const KIND_META: Record<
  TimelineEntry["kind"],
  { icon: LucideIcon; label: string; color: string }
> = {
  enquiry: { icon: Inbox, label: "Enquiry", color: "text-bb-teal" },
  booking: { icon: CalendarCheck, label: "Booking", color: "text-bb-gold" },
  session: { icon: ReceiptText, label: "Session", color: "text-bb-crimson" },
  email: { icon: Mail, label: "Email", color: "text-text-muted" },
  note: { icon: StickyNote, label: "Note", color: "text-text-muted" },
  loyalty: { icon: StarIcon, label: "Loyalty", color: "text-bb-gold" },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CustomerTimeline({ entries }: CustomerTimelineProps) {
  const sorted = sortTimeline(entries);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-card p-6 text-sm text-text-muted">
        No history yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border-default pl-6">
      {sorted.map((entry) => {
        const meta = KIND_META[entry.kind];
        const Icon = meta.icon;
        return (
          <li key={entry.id} className="relative">
            <span
              className="absolute -left-[34px] grid size-6 place-items-center rounded-full border border-border-default bg-bg-elevated"
              aria-hidden
            >
              <Icon className={`size-3.5 ${meta.color}`} />
            </span>
            <div className="rounded-lg border border-border-default bg-bg-card px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-text-primary">
                  <span className="sr-only">{meta.label}: </span>
                  {entry.title}
                </p>
                <time
                  className="text-xs tabular-nums text-text-muted"
                  dateTime={entry.at}
                >
                  {formatWhen(entry.at)}
                </time>
              </div>
              {entry.detail && (
                <p className="mt-1 text-sm text-text-secondary">{entry.detail}</p>
              )}
              {entry.status && (
                <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">
                  {entry.status}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
