"use client";

/**
 * The list of leads and the detail dialog behind each row. A row carries the
 * unread dot, the channel badge, the assigned-artist pill (owners) or the
 * Unassigned flag (artists), and the newest activity time; opening it is what
 * marks the thread read.
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPence } from "@/components/admin/money";
import { enquiryStatusLabel, formatDateTime } from "../_shared/labels";
import { isUnassigned } from "./enquiry-helpers";
import { EnquiryThread } from "./EnquiryThread";
import { EnquiryMeta } from "./EnquiryMeta";
import { ReplyComposer } from "./ReplyComposer";
import {
  CHANNEL_BADGE,
  useAction,
  type ArtistOption,
  type EnquiryItem,
} from "./inbox-shared";
import { claimEnquiry, markEnquiryRead } from "./actions";

export interface EnquiryListProps {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
  /** True when the page loaded its cap and older enquiries exist. */
  truncated: boolean;
  /** Lower-cased status label for the empty state ("new", "closed", …). */
  emptyLabel: string;
  /**
   * A `?open=` deep link resolved to a visible enquiry, or null/absent. This
   * is the caller's one-shot "pending" flag — it is expected to go back to
   * null (via `onAutoOpened`) the instant the row has opened, so a later
   * remount (tab/filter change) never reopens it.
   */
  openEnquiryId?: string | null;
  /** Called once, by the row that auto-opened, so the caller can clear its pending id. */
  onAutoOpened?: (id: string) => void;
  /**
   * The deep-linked enquiry fell outside the page and was fetched
   * separately — the "most recent" count below would otherwise read one
   * short of what is actually showing.
   */
  pinnedExtra?: boolean;
}

export function EnquiryList({
  items,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
  truncated,
  emptyLabel,
  openEnquiryId,
  onAutoOpened,
  pinnedExtra,
}: EnquiryListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
        No {emptyLabel} enquiries.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <EnquiryRow
              item={item}
              artists={artists}
              canConvert={canConvert}
              viewerArtistId={viewerArtistId}
              showAssignedPill={showAssignedPill}
              defaultOpen={item.id === openEnquiryId}
              onAutoOpened={onAutoOpened}
            />
          </li>
        ))}
      </ul>
      {truncated && (
        <p className="pt-1 text-center text-xs text-text-muted">
          {pinnedExtra
            ? "Showing the 300 most recent plus the linked enquiry — narrow the filters to reach older enquiries."
            : "Showing the 300 most recent — narrow the filters to reach older enquiries."}
        </p>
      )}
    </div>
  );
}

function EnquiryRow({
  item,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
  defaultOpen,
  onAutoOpened,
}: {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  showAssignedPill: boolean;
  defaultOpen: boolean;
  onAutoOpened?: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { pending, run } = useAction();

  // A deep link opens the thread without a click, so nothing would otherwise
  // clear its unread flag. Mount-only on purpose: every later open goes
  // through onOpenChange below. `onAutoOpened` tells the caller the pending
  // id has been consumed, so a later remount (tab/filter change) starts
  // from `defaultOpen: false` instead of forcing the dialog open again.
  useEffect(() => {
    if (defaultOpen) {
      if (item.unread) void markEnquiryRead(item.id);
      onAutoOpened?.(item.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Opening the thread is what counts as reading it.
        if (next && item.unread) void markEnquiryRead(item.id);
      }}
    >
      <DialogTrigger className="w-full rounded-lg border border-border-default bg-bg-card px-5 py-4 text-left transition-colors hover:border-border-strong">
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
      </DialogTrigger>
      {/*
        A sibling of the trigger, never inside it: the trigger is a <button>,
        and nesting a button inside a button is invalid HTML that browsers
        silently un-nest, breaking both controls.
      */}
      {viewerArtistId && isUnassigned(item) && (
        <div className="mt-1 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => claimEnquiry(item.id))}
          >
            Take this
          </Button>
        </div>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {item.contactName}
          </DialogTitle>
          <DialogDescription>
            {item.contactEmail ?? "No email"} ·{" "}
            {enquiryStatusLabel(item.status)}
          </DialogDescription>
        </DialogHeader>

        <EnquiryMeta
          item={item}
          artists={artists}
          canConvert={canConvert}
          viewerArtistId={viewerArtistId}
          onDone={() => setOpen(false)}
        />
        <EnquiryThread items={item.thread} />
        <ReplyComposer
          enquiryId={item.id}
          source={item.source}
          claimsOnReply={Boolean(viewerArtistId) && isUnassigned(item)}
          options={item.replyOptions}
          defaultChannel={item.defaultReplyChannel}
          onSent={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
