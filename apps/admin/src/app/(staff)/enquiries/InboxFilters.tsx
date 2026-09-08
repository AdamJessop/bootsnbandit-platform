"use client";

/**
 * Inbox chrome: the five status tabs with their counts, and the artist / style
 * / source dropdowns. Stateless — the orchestrator owns the values.
 */
import { useMemo } from "react";
import type { EnquiryStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { enquiryStatusLabel } from "../_shared/labels";
import {
  ALL,
  SOURCE_FILTER_ITEMS,
  STATUS_ORDER,
  type ArtistOption,
} from "./inbox-shared";

export interface InboxFiltersProps {
  tab: EnquiryStatus;
  onTabChange: (tab: EnquiryStatus) => void;
  counts: Record<EnquiryStatus, number>;
  artists: ArtistOption[];
  styles: string[];
  artistFilter: string;
  styleFilter: string;
  sourceFilter: string;
  onArtistFilter: (value: string) => void;
  onStyleFilter: (value: string) => void;
  onSourceFilter: (value: string) => void;
}

export function InboxFilters({
  tab,
  onTabChange,
  counts,
  artists,
  styles,
  artistFilter,
  styleFilter,
  sourceFilter,
  onArtistFilter,
  onStyleFilter,
  onSourceFilter,
}: InboxFiltersProps) {
  // Let the closed filter triggers render labels, never the raw "__all__"
  // sentinel or an artist cuid.
  const artistFilterItems = useMemo(
    () => [
      { value: ALL, label: "All artists" },
      ...artists.map((a) => ({ value: a.id, label: a.name })),
    ],
    [artists],
  );
  const styleFilterItems = useMemo(
    () => [
      { value: ALL, label: "All styles" },
      ...styles.map((s) => ({ value: s, label: s })),
    ],
    [styles],
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as EnquiryStatus)}
        className="min-w-0 max-w-full"
      >
        <TabsList className="h-auto! max-w-full flex-wrap gap-y-1">
          {STATUS_ORDER.map((s) => (
            <TabsTrigger key={s} value={s} className="h-8">
              {enquiryStatusLabel(s)}
              {/*
                The count is the server-side total for this status across
                everything the viewer can see; the dropdowns beside it filter
                the rows below client-side and never touch it. Said out loud
                here — a Closed tab reading 7 above two rows otherwise reads
                as a bug — rather than by recomputing the number, which would
                trade an explainable surprise for an under-report.
              */}
              <span
                className="ml-1.5 tabular-nums text-text-muted"
                title={`${counts[s]} in total — filters narrow the list only`}
                aria-label={`${counts[s]} in total — filters narrow the list only`}
              >
                {counts[s]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select
        items={artistFilterItems}
        value={artistFilter}
        onValueChange={(v) => onArtistFilter(v ?? ALL)}
      >
        <SelectTrigger className="w-40" aria-label="Filter by artist">
          <SelectValue placeholder="All artists" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All artists</SelectItem>
          {artists.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={styleFilterItems}
        value={styleFilter}
        onValueChange={(v) => onStyleFilter(v ?? ALL)}
      >
        <SelectTrigger className="w-40" aria-label="Filter by style">
          <SelectValue placeholder="All styles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All styles</SelectItem>
          {styles.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={SOURCE_FILTER_ITEMS}
        value={sourceFilter}
        onValueChange={(v) => onSourceFilter(v ?? ALL)}
      >
        <SelectTrigger className="w-40" aria-label="Filter by source">
          <SelectValue placeholder="All sources" />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_FILTER_ITEMS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
