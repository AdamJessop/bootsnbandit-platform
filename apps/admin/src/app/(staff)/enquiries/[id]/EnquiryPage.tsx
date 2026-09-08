"use client";

/**
 * One thing at a time. The enquiry page is a single reading column with a
 * segmented control — Conversation · Brief · Actions — instead of the old
 * dialog's everything-in-one-scroll. The composer is docked to the bottom
 * of the viewport in Conversation so a reply is always in reach; on wide
 * screens a slim rail keeps the brief in view while typing. Opening the
 * page is what marks the thread read.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ListChecks,
  MessageSquareText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@bnb/core/utils";
import {
  enquiryStatusLabel,
  enquiryStatusVariant,
  formatDateTime,
} from "../../_shared/labels";
import { isUnassigned } from "../enquiry-helpers";
import { EnquiryThread } from "../EnquiryThread";
import { ReplyComposer } from "../ReplyComposer";
import { CHANNEL_BADGE, type ArtistOption, type EnquiryItem } from "../inbox-shared";
import { markEnquiryRead } from "../actions";
import { EnquiryActions } from "./EnquiryActions";
import {
  briefFacts,
  EnquiryBrief,
  FactList,
  threadAttachments,
} from "./EnquiryBrief";

export type EnquiryView = "conversation" | "brief" | "actions";

export const VIEWS: { id: EnquiryView; label: string; icon: LucideIcon }[] = [
  { id: "conversation", label: "Conversation", icon: MessageSquareText },
  { id: "brief", label: "Brief", icon: FileText },
  { id: "actions", label: "Actions", icon: ListChecks },
];

const VIEW_INDEX: Record<EnquiryView, number> = {
  conversation: 0,
  brief: 1,
  actions: 2,
};

/** How many things the Brief tab is holding, for its count chip. */
export function briefCount(item: EnquiryItem): number {
  const board = item.moodboardData?.items.length ?? item.moodboard.length;
  return board + threadAttachments(item).length;
}

/**
 * Which way a panel slides in: forward along the control slides in from the
 * right, back slides in from the left, and the first paint does not move.
 */
export function slideClass(
  from: EnquiryView | null,
  to: EnquiryView,
): string {
  if (from === null || from === to) return "";
  return VIEW_INDEX[to] > VIEW_INDEX[from]
    ? "animate-in fade-in slide-in-from-right-4"
    : "animate-in fade-in slide-in-from-left-4";
}

export function SegmentedControl({
  value,
  onChange,
  counts,
}: {
  value: EnquiryView;
  onChange: (v: EnquiryView) => void;
  counts: Partial<Record<EnquiryView, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Enquiry views"
      className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1 rounded-lg border border-border-default bg-bg-base p-1 sm:grid-cols-3"
    >
      {VIEWS.map((v) => {
        const active = v.id === value;
        const Icon = v.icon;
        const n = counts[v.id];
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={`tab-${v.id}`}
            aria-selected={active}
            aria-controls={`panel-${v.id}`}
            onClick={() => onChange(v.id)}
            className={cn(
              "inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-1.5 font-termina text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap transition-colors duration-[var(--dur)] sm:gap-2 sm:px-3 sm:text-[12px] sm:tracking-[0.12em]",
              active
                ? "bg-bg-elevated text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                : "text-text-muted hover:bg-bg-raised hover:text-text-secondary",
            )}
          >
            <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
            <span>{v.label}</span>
            {n ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                  active
                    ? "bg-bb-gold/20 text-bb-gold"
                    : "bg-bg-raised text-text-muted",
                )}
              >
                {n}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SummaryRail({ item }: { item: EnquiryItem }) {
  const board = item.moodboardData?.items ?? [];
  const files = threadAttachments(item).filter(
    (a) => a.hasBytes && a.mime.startsWith("image/"),
  );
  const thumbs = [
    ...board.map((b, i) => ({
      key: `b-${i}`,
      src: b.thumbUrl ?? b.url,
      alt: b.title ?? `Board image ${i + 1}`,
    })),
    ...files.map((f) => ({
      key: f.id,
      src: `/api/attachments/${f.id}`,
      alt: f.filename ?? "Attachment",
    })),
  ].slice(0, 6);
  return (
    <aside className="hidden lg:block" aria-label="At a glance">
      <div className="sticky top-24 space-y-6 border-l border-border-default pl-6">
        <div className="space-y-1 text-sm">
          <p className="font-termina text-[11px] font-bold uppercase tracking-[0.16em] text-bb-gold">
            At a glance
          </p>
          <p className="truncate text-text-secondary">
            {item.contactEmail ?? "No email on file"}
          </p>
          <p className="text-text-muted">
            Received {formatDateTime(item.createdAtISO)}
          </p>
        </div>
        <FactList facts={briefFacts(item)} dense />
        {item.description && (
          <p className="line-clamp-5 text-sm leading-relaxed text-text-secondary">
            {item.description}
          </p>
        )}
        {thumbs.length > 0 && (
          <ul className="grid grid-cols-3 gap-1.5">
            {thumbs.map((t) => (
              <li key={t.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.src}
                  alt={t.alt}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full rounded-md border border-border-default object-cover"
                />
              </li>
            ))}
          </ul>
        )}
        {item.customerId && (
          <Link
            href={`/customers/${item.customerId}`}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-bb-gold hover:text-bb-gold-soft"
          >
            View customer <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </aside>
  );
}

export function EnquiryPage({
  item,
  artists,
  canConvert,
  viewerArtistId,
  initialView = "conversation",
}: {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  initialView?: EnquiryView;
}) {
  const router = useRouter();
  const [view, setView] = useState<EnquiryView>(initialView);
  // The view we came from, so the panel knows which way to slide. Null on
  // the first paint: a page should not move on arrival.
  const [cameFrom, setCameFrom] = useState<EnquiryView | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  // Once the name scrolls away (which scroll-to-newest does on landing), the
  // sticky bar carries it, so staff always know whose thread they are in.
  const [headerOut, setHeaderOut] = useState(false);
  // The docked composer covers the bottom of the column; the thread keeps
  // that much clear so the newest message lands directly above it.
  const [dockHeight, setDockHeight] = useState(0);

  const switchView = (next: EnquiryView) => {
    if (next === view) return;
    setCameFrom(view);
    setView(next);
  };

  // Landing here is reading it. Swallowed on purpose: an enquiry reassigned
  // between render and mount throws Forbidden, and a dot that did not clear
  // is not worth an unhandled rejection.
  useEffect(() => {
    if (item.unread) markEnquiryRead(item.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setHeaderOut(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (view !== "conversation") return;
    const dock = dockRef.current;
    if (!dock || typeof ResizeObserver === "undefined") return;
    // The dock sits above the 64px bottom nav below lg; the thread must
    // clear both, or the newest message lands behind the composer.
    const wide = window.matchMedia("(min-width: 1024px)");
    const measure = () =>
      setDockHeight(dock.offsetHeight + (wide.matches ? 0 : 64));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(dock);
    return () => ro.disconnect();
  }, [view]);

  // The newest message is what staff came for: start there, clear of the dock.
  useEffect(() => {
    if (view === "conversation" && dockHeight > 0) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [view, dockHeight, item.thread.length]);

  const unassigned = isUnassigned(item);
  const pending = item.status === "customer_replied" || item.status === "new";
  const panelClass = cn(
    "duration-[var(--dur)] ease-[var(--ease-out)] motion-reduce:animate-none",
    slideClass(cameFrom, view),
  );

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-6 pt-8 sm:px-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10">
        <main id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
          <Link
            href="/enquiries"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden /> Enquiries
          </Link>

          <header ref={headerRef} className="mt-2">
            <h1 className="display text-[clamp(26px,4vw,38px)] text-text-primary">
              {item.contactName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={enquiryStatusVariant(item.status)}>
                {enquiryStatusLabel(item.status)}
              </Badge>
              <Badge variant="outline">{CHANNEL_BADGE[item.channel]}</Badge>
              {unassigned ? (
                <Badge>Unassigned</Badge>
              ) : (
                <Badge variant="secondary">{item.preferredArtistName}</Badge>
              )}
              <span className="text-text-muted">
                {pending && item.lastMessageAtISO
                  ? `Waiting since ${formatDateTime(item.lastMessageAtISO)}`
                  : `Last activity ${formatDateTime(item.lastMessageAtISO ?? item.createdAtISO)}`}
              </span>
            </div>
          </header>

          <div className="sticky top-16 z-10 -mx-5 mt-5 bg-bg-base/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            {headerOut && (
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <span className="truncate font-termina text-[13px] font-bold text-text-primary">
                  {item.contactName}
                </span>
                <Badge variant={enquiryStatusVariant(item.status)}>
                  {enquiryStatusLabel(item.status)}
                </Badge>
              </div>
            )}
            <SegmentedControl
              value={view}
              onChange={switchView}
              counts={{
                conversation: item.thread.length,
                brief: briefCount(item) || undefined,
              }}
            />
          </div>

          {view === "conversation" && (
            <div key="conversation" className={panelClass}>
              <div className="pt-5">
                <EnquiryThread items={item.thread} heading={false} />
                <div ref={endRef} style={{ scrollMarginBottom: dockHeight }} />
              </div>
              {/*
                Docked: sticky at the viewport bottom on wide screens and
                directly above the 64px bottom nav on phones, with its own
                ground so nothing scrolls through the gap.
              */}
              <div
                ref={dockRef}
                className="sticky bottom-16 z-10 -mx-5 mt-4 border-t border-border-default bg-bg-base px-5 pt-3 pb-3 sm:-mx-6 sm:px-6 lg:bottom-0"
              >
                <ReplyComposer
                  enquiryId={item.id}
                  source={item.source}
                  claimsOnReply={Boolean(viewerArtistId) && unassigned}
                  options={item.replyOptions}
                  defaultChannel={item.defaultReplyChannel}
                  onSent={() => router.refresh()}
                />
              </div>
            </div>
          )}

          {view === "brief" && (
            <div key="brief" className={cn(panelClass, "pt-6")}>
              <EnquiryBrief item={item} />
            </div>
          )}

          {view === "actions" && (
            <div key="actions" className={cn(panelClass, "pt-6")}>
              <EnquiryActions
                item={item}
                artists={artists}
                canConvert={canConvert}
                viewerArtistId={viewerArtistId}
              />
            </div>
          )}
        </main>
        <SummaryRail item={item} />
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
