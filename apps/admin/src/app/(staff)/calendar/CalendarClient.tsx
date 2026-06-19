"use client";

/**
 * Calendar surface client island (Phase 9). Owns view/day/artist UI state, hosts
 * the CalendarGrid and BookingDrawer, and persists create/move/edit through the
 * Phase-9 server actions (which call the Phase-6 booking service). Conflicts are
 * surfaced as toasts; the grid refreshes via router.refresh() after a write.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarGrid,
  type CalendarEvent,
  type CalendarLeave,
  type CalendarView,
} from "@/components/admin/CalendarGrid";
import {
  BookingDrawer,
  type BookingDraft,
  type NamedOption,
} from "@/components/admin/BookingDrawer";
import type { BookingPayload } from "@/components/admin/booking-form";
import { saveBookingAction, updateBookingAction } from "./actions";
import { shiftAnchor } from "./nav";

export interface CalendarClientProps {
  canSwitchArtist: boolean;
  artists: NamedOption[];
  activeArtistId: string;
  view: CalendarView;
  /** ISO anchor date. */
  anchorISO: string;
  events: CalendarEvent[];
  leave: CalendarLeave[];
  customers: NamedOption[];
}

const HEADING = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function CalendarClient({
  canSwitchArtist,
  artists,
  activeArtistId,
  view,
  anchorISO,
  events,
  leave,
  customers,
}: CalendarClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BookingDraft | undefined>(undefined);

  const navigate = (next: {
    view?: CalendarView;
    anchor?: string;
    artist?: string;
  }) => {
    const params = new URLSearchParams({
      view: next.view ?? view,
      date: next.anchor ?? anchorISO,
      artist: next.artist ?? activeArtistId,
    });
    startTransition(() => router.push(`/calendar?${params.toString()}`));
  };

  function openCreate(startISO?: string) {
    setEditing(
      startISO ? { start: startISO, artistId: activeArtistId } : undefined,
    );
    setDrawerOpen(true);
  }

  function openEdit(eventId: string) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const durationMins = Math.round(
      (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000,
    );
    setEditing({
      id: ev.id,
      artistId: activeArtistId,
      type: ev.type,
      style: ev.title,
      start: ev.start,
      durationMins,
      status: ev.status as BookingDraft["status"],
    });
    setDrawerOpen(true);
  }

  async function handleSave(
    payload: BookingPayload,
    id?: string,
  ): Promise<string | null> {
    const res = id
      ? await updateBookingAction({
          id,
          artistId: payload.artistId,
          start: payload.start,
          end: payload.end,
          type: payload.type,
          style: payload.style,
          placement: payload.placement,
          durationMin: payload.durationMin,
          priceEstimatePence: payload.priceEstimatePence,
          notes: payload.notes,
          status: payload.status,
        })
      : await saveBookingAction(payload);
    if (!res.ok) return res.error ?? "Could not save.";
    toast.success(id ? "Booking updated" : "Booking created");
    startTransition(() => router.refresh());
    return null;
  }

  function handleMove(eventId: string, startISO: string, endISO: string) {
    startTransition(async () => {
      const res = await updateBookingAction({
        id: eventId,
        artistId: activeArtistId,
        start: startISO,
        end: endISO,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not move booking");
        router.refresh(); // snap block back to its stored position
        return;
      }
      toast.success("Booking moved");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Toaster position="top-center" />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() =>
              navigate({ anchor: shiftAnchor(anchorISO, view, -1) })
            }
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            onClick={() => navigate({ anchor: shiftAnchor(anchorISO, view, 1) })}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ anchor: new Date().toISOString() })}
          >
            Today
          </Button>
        </div>

        <h2 className="font-termina text-sm uppercase tracking-wide text-text-primary">
          {HEADING.format(new Date(anchorISO))}
        </h2>

        <div className="ml-auto flex items-center gap-3">
          {canSwitchArtist && artists.length > 1 ? (
            <Select
              value={activeArtistId}
              onValueChange={(v) => navigate({ artist: v ?? activeArtistId })}
            >
              <SelectTrigger aria-label="Artist" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Tabs
            value={view}
            onValueChange={(v) => navigate({ view: v as CalendarView })}
          >
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button size="sm" onClick={() => openCreate()}>
            <CalendarPlus />
            New
          </Button>
        </div>
      </div>

      <div className={pending ? "opacity-60 transition-opacity" : undefined}>
        <CalendarGrid
          artistId={activeArtistId}
          view={view}
          date={anchorISO}
          events={events}
          leave={leave}
          onCreate={openCreate}
          onSelect={openEdit}
          onMove={handleMove}
        />
      </div>

      <BookingDrawer
        open={drawerOpen}
        booking={editing}
        customers={customers}
        artists={artists}
        defaultArtistId={activeArtistId}
        onSave={handleSave}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
