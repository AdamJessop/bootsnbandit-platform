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
import {
  countByStatus,
  distinctStyles,
  filterEnquiries,
} from "./enquiry-helpers";
import { InboxFilters } from "./InboxFilters";
import { EnquiryList } from "./EnquiryList";
import { ALL, type ArtistOption, type EnquiryItem } from "./inbox-shared";

export type { ArtistOption, EnquiryItem } from "./inbox-shared";

export function EnquiryInbox({
  items,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
}: {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
}) {
  const [tab, setTab] = useState<EnquiryStatus>("new");
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [styleFilter, setStyleFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const counts = useMemo(() => countByStatus(items), [items]);
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
        emptyLabel={enquiryStatusLabel(tab).toLowerCase()}
      />
      <Toaster position="top-center" />
    </div>
  );
}
