"use client";

/**
 * The Brief view: who they are, what they asked for, and every reference
 * they sent — the mood board plus every image or file attached anywhere in
 * the thread, gathered in one place so nobody scrolls a conversation to
 * find a photo of the arm.
 */
import Link from "next/link";
import { CalendarClock, ExternalLink, Mail } from "lucide-react";
import { formatPence } from "@/components/admin/money";
import { formatDay } from "../../_shared/labels";
import {
  MoodBoardBriefSection,
  MoodboardSection,
} from "../EnquiryDetailSections";
import { attachmentHref } from "../enquiry-helpers";
import type { EnquiryItem } from "../inbox-shared";
import type { ThreadAttachmentItem } from "../EnquiryThread";

export interface BriefFact {
  label: string;
  value: string | null;
}

/** The four facts every enquiry carries, in the order staff read them. */
export function briefFacts(item: EnquiryItem): BriefFact[] {
  return [
    { label: "Style", value: item.style },
    { label: "Placement", value: item.placement },
    { label: "Size", value: item.size },
    {
      label: "Budget",
      value: item.budgetPence != null ? formatPence(item.budgetPence) : null,
    },
  ];
}

/** Every attachment on the thread, newest message last, in one flat list. */
export function threadAttachments(item: EnquiryItem): ThreadAttachmentItem[] {
  return item.thread.flatMap((m) => m.attachments);
}

export function FactList({
  facts,
  dense = false,
}: {
  facts: BriefFact[];
  dense?: boolean;
}) {
  return (
    <dl
      className={
        dense
          ? "grid grid-cols-2 gap-x-4 gap-y-3"
          : "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"
      }
    >
      {facts.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="font-termina text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
            {f.label}
          </dt>
          <dd
            className={
              f.value
                ? "mt-1 truncate text-[15px] text-text-primary"
                : "mt-1 text-[15px] text-text-disabled"
            }
          >
            {f.value ?? "Not given"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-termina text-[11px] font-bold uppercase tracking-[0.16em] text-bb-gold">
      {children}
    </h2>
  );
}

export function AttachmentGrid({ items }: { items: ThreadAttachmentItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((a) => {
        const href = attachmentHref(a);
        const name = a.filename ?? `Attachment ${a.id.slice(0, 6)}`;
        const image = a.hasBytes && a.mime.startsWith("image/");
        if (!href) {
          return (
            <li
              key={a.id}
              className="grid aspect-square place-items-center rounded-md border border-dashed border-border-default px-2 text-center text-xs text-text-muted"
            >
              {name} (unavailable)
            </li>
          );
        }
        return (
          <li key={a.id}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-md border border-border-default bg-bg-base transition-colors hover:border-border-strong"
              title={name}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={href}
                  alt={name}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="grid aspect-square place-items-center px-2 text-center text-xs text-text-secondary underline underline-offset-4">
                  {name}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function EnquiryBrief({ item }: { item: EnquiryItem }) {
  const files = threadAttachments(item);
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle>Contact</SectionTitle>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {item.contactEmail ? (
            <a
              href={`mailto:${item.contactEmail}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-text-secondary hover:text-text-primary"
            >
              <Mail className="size-4 text-text-muted" aria-hidden />
              {item.contactEmail}
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-1.5 text-text-muted">
              <Mail className="size-4" aria-hidden /> No email
            </span>
          )}
          <span className="inline-flex min-h-11 items-center gap-1.5 text-text-muted">
            <CalendarClock className="size-4" aria-hidden />
            Received {formatDay(item.createdAtISO)}
          </span>
          {item.customerId && (
            <Link
              href={`/customers/${item.customerId}`}
              className="inline-flex min-h-11 items-center gap-1 text-bb-gold hover:text-bb-gold-soft"
            >
              View customer
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>The idea</SectionTitle>
        <FactList facts={briefFacts(item)} />
        {item.description ? (
          <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed text-text-secondary">
            {item.description}
          </p>
        ) : (
          <p className="text-sm text-text-disabled">
            No written brief — the thread has what they said.
          </p>
        )}
      </section>

      <MoodBoardBriefSection data={item.moodboardData} />
      <MoodboardSection urls={item.moodboard} data={item.moodboardData} />

      {files.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Files from the thread ({files.length})</SectionTitle>
          <AttachmentGrid items={files} />
        </section>
      )}
    </div>
  );
}
