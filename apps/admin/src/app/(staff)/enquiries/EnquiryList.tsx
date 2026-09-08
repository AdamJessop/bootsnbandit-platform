"use client";

/**
 * The list of leads and the detail dialog behind each row. A row carries the
 * unread dot, the channel badge, the assigned-artist pill (owners) or the
 * Unassigned flag (artists), and the newest activity time; opening it is what
 * marks the thread read.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  type ArtistOption,
  type EnquiryItem,
} from "./inbox-shared";
import { markEnquiryRead } from "./actions";

export interface EnquiryListProps {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
  /** Lower-cased status label for the empty state ("new", "closed", …). */
  emptyLabel: string;
}

export function EnquiryList({
  items,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
  emptyLabel,
}: EnquiryListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
        No {emptyLabel} enquiries.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <EnquiryRow
            item={item}
            artists={artists}
            canConvert={canConvert}
            viewerArtistId={viewerArtistId}
            showAssignedPill={showAssignedPill}
          />
        </li>
      ))}
    </ul>
  );
}

function EnquiryRow({
  item,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
}: {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  showAssignedPill: boolean;
}) {
  const [open, setOpen] = useState(false);

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
          onSent={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
