"use client";

/**
 * Enquiry inbox (BACKOFHOUSE-IA E1/E2). Owns the filter state and composes the
 * pieces: InboxFilters (tabs + dropdowns), EnquiryList (rows + detail dialog),
 * and the toaster every action reports through. Every authorisation decision
 * belongs to the server actions, not to this island.
 */
import { useMemo, useState } from "react";
import type { EnquirySource, EnquiryStatus } from "@prisma/client";
import { Toaster } from "@/components/ui/sonner";
import { enquiryStatusLabel } from "../_shared/labels";
import { distinctStyles, filterEnquiries } from "./enquiry-helpers";
import { InboxFilters } from "./InboxFilters";
import { EnquiryList } from "./EnquiryList";
import { ALL, type ArtistOption, type EnquiryItem } from "./inbox-shared";

export type { ArtistOption, EnquiryItem } from "./inbox-shared";

export function EnquiryInbox({
  items,
  artists,
  counts,
  truncated,
  canConvert,
  viewerArtistId,
  showAssignedPill,
  openEnquiryId,
  openTab,
  notice,
  pinnedExtra,
}: {
  items: EnquiryItem[];
  artists: ArtistOption[];
  /**
   * Every enquiry this viewer can see, per status — computed server-side over
   * the whole visible set, not just the page of rows below. Typed structurally
   * rather than as core's `EnquiryStatusCounts`: that module imports the Prisma
   * client, which a client component must not reference even in a type
   * position.
   */
  counts: Record<EnquiryStatus, number>;
  /** The page hit its cap — the list says so under the rows. */
  truncated: boolean;
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
  /** A `?open=` deep link resolved to a visible enquiry, or null. */
  openEnquiryId: string | null;
  /** The tab that enquiry lives on, so the link lands where it can be seen. */
  openTab: EnquiryStatus | null;
  /** Quiet explanation when the link could not be honoured. */
  notice: string | null;
  /**
   * True when the deep-linked enquiry was fetched separately because it fell
   * outside the 300-row page — the "most recent" count under the list would
   * otherwise be off by one.
   */
  pinnedExtra?: boolean;
}) {
  const [tab, setTab] = useState<EnquiryStatus>(openTab ?? "new");
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [styleFilter, setStyleFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  // A deep link auto-opens its row exactly once. Left as `openEnquiryId`
  // forever, a later tab/filter change would unmount and remount that row
  // and its `defaultOpen` would force the dialog open again (and re-mark it
  // read). Consumed via `onAutoOpened` below, the moment the row has opened.
  const [pendingOpenId, setPendingOpenId] = useState(openEnquiryId);
  const styles = useMemo(() => distinctStyles(items), [items]);

  const visible = filterEnquiries(
    items.filter((i) => i.status === tab),
    {
      artistId: artistFilter === ALL ? null : artistFilter,
      style: styleFilter === ALL ? null : styleFilter,
      source: sourceFilter === ALL ? null : (sourceFilter as EnquirySource),
    },
  );

  return (
    <div className="space-y-5">
      {notice && (
        <p className="rounded-md border border-border-default bg-bg-base px-4 py-3 text-sm text-text-muted">
          {notice}
        </p>
      )}
      <InboxFilters
        tab={tab}
        onTabChange={setTab}
        counts={counts}
        artists={artists}
        styles={styles}
        artistFilter={artistFilter}
        styleFilter={styleFilter}
        sourceFilter={sourceFilter}
        onArtistFilter={setArtistFilter}
        onStyleFilter={setStyleFilter}
        onSourceFilter={setSourceFilter}
      />
      <EnquiryList
        items={visible}
        artists={artists}
        canConvert={canConvert}
        viewerArtistId={viewerArtistId}
        showAssignedPill={showAssignedPill}
        truncated={truncated}
        emptyLabel={enquiryStatusLabel(tab).toLowerCase()}
        openEnquiryId={pendingOpenId}
        onAutoOpened={() => setPendingOpenId(null)}
        pinnedExtra={pinnedExtra}
      />
      <Toaster position="top-center" />
    </div>
  );
}
