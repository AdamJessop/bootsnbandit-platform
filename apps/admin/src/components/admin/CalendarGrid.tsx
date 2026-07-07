"use client";

/**
 * Calendar day/week grid (BACKOFHOUSE-IA C1/C2). A CSS time-grid for the studio
 * window (Tue–Sat 10:00–18:00) with status-coloured booking blocks. Click an
 * empty slot → onCreate(ISO); click a block → onSelect(id); drag a block
 * vertically → onMove(id, startISO, endISO). All geometry is delegated to the
 * tested ./calendar-layout helpers so this file is pure presentation + pointer
 * wiring. Leave/closed days are shaded.
 */

import { useRef, useState } from "react";
import { cn } from "@bnb/core/utils";
import {
  GRID_START_HOUR,
  PX_PER_MIN,
  applyDragDelta,
  artistTone,
  blockTone,
  eventBox,
  gridHeightPx,
  isSameDay,
  isWorkingDay,
  pxToSlotStart,
  slotLabels,
  weekDays,
  type ArtistTone,
  type BlockTone,
} from "./calendar-layout";
import { CalendarLegend } from "./CalendarLegend";

export type CalendarView = "day" | "week";

export interface CalendarEvent {
  id: string;
  type: "consult" | "session" | "flash";
  title: string;
  /** ISO start/end timestamps. */
  start: string;
  end: string;
  status?: string;
  customerName?: string;
  /** Owning artist — used by the all-staff modes. */
  artistId?: string;
}

/** A shaded range (artist leave / studio-closed day). */
export interface CalendarLeave {
  start: string;
  end: string;
  /** In allStaff day mode, shade only this artist's column when set. */
  artistId?: string;
}

/** Artist descriptor for the all-staff modes. */
export interface CalendarArtist {
  id: string;
  name: string;
  hue: string | null;
}

/** Per-artist display metadata resolved once per render. */
interface ArtistOverlay {
  toneById: Map<string, ArtistTone>;
  nameById: Map<string, string>;
}

export interface CalendarGridProps {
  /** Artist whose calendar is shown (owner/front-desk can switch). */
  artistId: string;
  view: CalendarView;
  /** Anchor date (ISO, day or week-of). */
  date: string;
  events: CalendarEvent[];
  /** Approved-leave ranges to shade. */
  leave?: CalendarLeave[];
  /** "single" (default) = one artist; "allStaff" = every artist at once. */
  mode?: "single" | "allStaff";
  /** Artists rendered in allStaff mode (column/colour order). */
  artists?: CalendarArtist[];
  /** Drag an event to a new slot (ISO start/end). */
  onMove?: (eventId: string, start: string, end: string) => void;
  /**
   * Click an empty slot to create a booking (ISO start). In allStaff day
   * mode the clicked column's artistId is passed as the second argument.
   */
  onCreate?: (start: string, artistId?: string) => void;
  /** Click an existing block to edit. */
  onSelect?: (eventId: string) => void;
}

const TONE_CLASS: Record<BlockTone, string> = {
  crimson: "bg-bb-crimson/20 border-bb-crimson/60 text-text-primary",
  gold: "bg-bb-gold/20 border-bb-gold/60 text-text-primary",
  teal: "bg-bb-teal/20 border-bb-teal/60 text-text-primary",
  muted:
    "bg-bg-card border-border-default text-text-muted line-through opacity-70",
};

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
});

export function CalendarGrid({
  view,
  date,
  events,
  leave = [],
  mode = "single",
  artists = [],
  onMove,
  onCreate,
  onSelect,
}: CalendarGridProps) {
  const anchor = new Date(date);
  const days = view === "week" ? weekDays(anchor) : [anchor];
  const allStaff = mode === "allStaff" && artists.length > 0;
  const overlay: ArtistOverlay | undefined =
    allStaff && view === "week"
      ? {
          toneById: new Map(
            artists.map((a, i) => [a.id, artistTone(a.hue, i)]),
          ),
          nameById: new Map(artists.map((a) => [a.id, a.name])),
        }
      : undefined;

  return (
    <div className="rounded-lg border border-border-default bg-bg-base">
      <div className="flex">
        {/* time gutter */}
        <div className="w-14 shrink-0 border-r border-border-default pt-8">
          {slotLabels().map((label) => (
            <div
              key={label}
              className="relative h-[60px] text-right pr-2 text-[11px] tabular-nums text-text-muted"
            >
              <span className="absolute -top-2 right-2">{label}</span>
            </div>
          ))}
        </div>
        {allStaff && view === "day" ? (
          /* one column per artist on the anchor day */
          <div className="flex flex-1">
            {artists.map((a) => (
              <DayColumn
                key={a.id}
                day={anchor}
                label={a.name}
                compact={artists.length > 3}
                events={events.filter((e) => e.artistId === a.id)}
                leave={leave.filter((l) => !l.artistId || l.artistId === a.id)}
                createArtistId={a.id}
                onMove={onMove}
                onCreate={onCreate}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          /* day columns (single artist, or week overlay across artists) */
          <div className="flex flex-1">
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                compact={view === "week"}
                events={events}
                leave={leave}
                overlay={overlay}
                onMove={onMove}
                onCreate={onCreate}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
      {overlay ? <CalendarLegend artists={artists} /> : null}
    </div>
  );
}

function DayColumn({
  day,
  compact,
  events,
  leave,
  label,
  createArtistId,
  overlay,
  onMove,
  onCreate,
  onSelect,
}: {
  day: Date;
  compact: boolean;
  events: CalendarEvent[];
  leave: CalendarLeave[];
  /** Header text override (artist name in allStaff day mode). */
  label?: string;
  /** Passed through to onCreate as the column's artist (allStaff day mode). */
  createArtistId?: string;
  /** Per-artist tint/name lookup (allStaff week overlay). */
  overlay?: ArtistOverlay;
  onMove?: (id: string, start: string, end: string) => void;
  onCreate?: (start: string, artistId?: string) => void;
  onSelect?: (id: string) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const closed = !isWorkingDay(day);
  const dayEvents = events.filter((e) => isSameDay(new Date(e.start), day));
  const dayLeave = leave.filter((l) => isSameDay(new Date(l.start), day));

  function handleEmptyClick(e: React.MouseEvent<HTMLDivElement>) {
    if (closed || !onCreate || dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const start = pxToSlotStart(e.clientY - rect.top, day);
    onCreate(start.toISOString(), createArtistId);
  }

  return (
    <div className="flex-1 border-r border-border-default last:border-r-0">
      <div className="flex h-8 items-center justify-center border-b border-border-default text-xs font-medium text-text-secondary">
        {label ?? DAY_LABEL.format(day)}
      </div>
      <div
        ref={colRef}
        onClick={handleEmptyClick}
        className={cn(
          "relative",
          closed
            ? "bg-bg-card/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.02)_6px,rgba(255,255,255,0.02)_12px)]"
            : "cursor-pointer",
        )}
        style={{ height: gridHeightPx() }}
      >
        {/* hour gridlines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-x-0 border-t border-border-default/50"
            style={{ top: i * 60 * PX_PER_MIN }}
          />
        ))}
        {/* leave shading */}
        {dayLeave.map((l, i) => {
          const box = eventBox(new Date(l.start), new Date(l.end));
          return (
            <div
              key={`leave-${i}`}
              className="absolute inset-x-0 bg-bg-card/80 [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(201,47,77,0.12)_5px,rgba(201,47,77,0.12)_10px)]"
              style={{ top: box.topPx, height: box.heightPx }}
            />
          );
        })}
        {/* blocks */}
        {dayEvents.map((ev) => (
          <EventBlock
            key={ev.id}
            event={ev}
            compact={compact}
            colRef={colRef}
            day={day}
            overlayClass={
              overlay && ev.artistId
                ? overlay.toneById.get(ev.artistId)?.block
                : undefined
            }
            artistName={
              overlay && ev.artistId
                ? overlay.nameById.get(ev.artistId)
                : undefined
            }
            onMoveStart={() => setDragId(ev.id)}
            onMoveEnd={(start, end) => {
              setDragId(null);
              onMove?.(ev.id, start, end);
            }}
            onSelect={() => onSelect?.(ev.id)}
          />
        ))}
      </div>
    </div>
  );
}

function EventBlock({
  event,
  compact,
  colRef,
  day,
  overlayClass,
  artistName,
  onMoveStart,
  onMoveEnd,
  onSelect,
}: {
  event: CalendarEvent;
  compact: boolean;
  colRef: React.RefObject<HTMLDivElement | null>;
  day: Date;
  /** Artist-tint classes replacing the status tone (allStaff week overlay). */
  overlayClass?: string;
  /** Artist name shown on the block (allStaff week overlay). */
  artistName?: string;
  onMoveStart: () => void;
  onMoveEnd: (start: string, end: string) => void;
  onSelect: () => void;
}) {
  const box = eventBox(new Date(event.start), new Date(event.end));
  const tone = blockTone(event.type, event.status);
  const draggingRef = useRef<{ startY: number; moved: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!colRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = { startY: e.clientY, moved: false };
    onMoveStart();
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = draggingRef.current;
    if (!drag) return;
    if (Math.abs(e.clientY - drag.startY) > 3) drag.moved = true;
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = draggingRef.current;
    draggingRef.current = null;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drag.moved) {
      onSelect();
      return;
    }
    const deltaPx = e.clientY - drag.startY;
    const next = applyDragDelta(
      new Date(event.start),
      new Date(event.end),
      deltaPx,
    );
    // applyDragDelta normalises to GRID_START_HOUR on the event's own day;
    // re-anchor onto the column day so the date stays correct.
    const minutes =
      (next.start.getHours() - GRID_START_HOUR) * 60 + next.start.getMinutes();
    const durationMin = Math.round(
      (next.end.getTime() - next.start.getTime()) / 60000,
    );
    const start = new Date(day);
    start.setHours(GRID_START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + minutes);
    const end = new Date(start.getTime() + durationMin * 60000);
    onMoveEnd(start.toISOString(), end.toISOString());
  }

  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        "absolute inset-x-1 touch-none overflow-hidden rounded-md border px-2 py-1 text-left text-xs transition-colors",
        overlayClass ?? TONE_CLASS[tone],
      )}
      style={{ top: box.topPx, height: box.heightPx }}
    >
      <span className="block truncate font-medium">{event.title}</span>
      {artistName ? (
        <span className="block truncate text-[10px] opacity-80">
          {artistName}
        </span>
      ) : null}
      {!compact && event.customerName ? (
        <span className="block truncate text-[11px] opacity-80">
          {event.customerName}
        </span>
      ) : null}
    </button>
  );
}
