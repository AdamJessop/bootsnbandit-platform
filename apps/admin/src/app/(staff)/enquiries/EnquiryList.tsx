"use client";

/**
 * The list of leads. A row carries the unread dot, the channel badge, the
 * assigned-artist pill (owners) or the Unassigned flag (artists), and the
 * newest activity time. A row is a link to the enquiry's own page; landing
 * there is what marks the thread read.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPence } from "@/components/admin/money";
import { formatDateTime } from "../_shared/labels";
import { enquiryHref, isUnassigned } from "./enquiry-helpers";
import {
  CHANNEL_BADGE,
  useAction,
  type ArtistOption,
  type EnquiryItem,
} from "./inbox-shared";
import { claimEnquiry } from "./actions";

export interface EnquiryListProps {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
  /** True when the page loaded its cap and older enquiries exist. */
  truncated: boolean;
  /**
   * The server's row cap, so the note below can say what it actually is
   * rather than repeat a number that would quietly go stale the day
   * `INBOX_PAGE_SIZE` changes.
   */
  pageSize: number;
  /** Lower-cased status label for the empty state ("new", "closed", …). */
  emptyLabel: string;
}

export function EnquiryList({
  items,
  viewerArtistId,
  showAssignedPill,
  truncated,
  pageSize,
  emptyLabel,
}: EnquiryListProps) {
  // One wrapper around both states on purpose. The note belongs MOST on an
  // empty tab — "no closed enquiries" is a flat lie when the studio has
  // hundreds older than the page — and the early return used to eat it.
  //
  // The advice has to be advice the code can honour: the dropdowns filter the
  // rows already fetched, client-side, so narrowing them can only ever show
  // fewer. The customer record is the route to an older thread.
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
          No {emptyLabel} enquiries.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <EnquiryRow
                item={item}
                viewerArtistId={viewerArtistId}
                showAssignedPill={showAssignedPill}
              />
            </li>
          ))}
        </ul>
      )}
      {truncated && (
        <p className="pt-1 text-center text-xs text-text-muted">
          {`Showing the ${pageSize} most recent enquiries — older ones are not loaded here. Open an older enquiry from the customer's record.`}
        </p>
      )}
    </div>
  );
}

function EnquiryRow({
  item,
  viewerArtistId,
  showAssignedPill,
}: {
  item: EnquiryItem;
  viewerArtistId: string | null;
  showAssignedPill: boolean;
}) {
  const { pending, run } = useAction();
  const claimable = Boolean(viewerArtistId) && isUnassigned(item);

  return (
    <div className="rounded-lg border border-border-default bg-bg-card transition-colors hover:border-border-strong has-[a:focus-visible]:border-bb-crimson">
      <Link
        href={enquiryHref(item.id)}
        className="flex min-h-11 items-center gap-3 px-5 py-4 outline-none"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium text-text-primary">
              {item.unread && (
                <span
                  className="size-2 shrink-0 rounded-full bg-bb-crimson"
                  role="img"
                  aria-label="Unread"
                />
              )}
              {item.contactName}
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="outline">{CHANNEL_BADGE[item.channel]}</Badge>
              {showAssignedPill && (
                <Badge
                  variant={item.preferredArtistName ? "secondary" : "default"}
                >
                  {item.preferredArtistName ?? "Unassigned"}
                </Badge>
              )}
              {!showAssignedPill && isUnassigned(item) && (
                <Badge>Unassigned</Badge>
              )}
              <span className="text-xs text-text-muted">
                {formatDateTime(item.lastMessageAtISO ?? item.createdAtISO)}
              </span>
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-text-muted">
            {item.subject ??
              ([item.style, item.placement, item.size]
                .filter(Boolean)
                .join(" · ") ||
                "No brief")}
            {item.budgetPence != null
              ? ` · budget ${formatPence(item.budgetPence)}`
              : ""}
          </p>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-text-disabled"
          aria-hidden
        />
      </Link>
      {/*
        A sibling of the link, never inside it: a button inside an anchor is
        invalid HTML that browsers silently un-nest, breaking both controls.
      */}
      {claimable && (
        <div className="flex justify-end border-t border-border-subtle px-5 py-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-9"
            disabled={pending}
            onClick={() => run(() => claimEnquiry(item.id))}
          >
            Take this
          </Button>
        </div>
      )}
    </div>
  );
}
