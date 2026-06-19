"use client";

/**
 * Front-desk in-studio board (BACKOFHOUSE-IA D). Cards for every artist believed
 * in today with a present/away toggle and their current/next client. Picking an
 * artist opens their day calendar inline (CalendarGrid) with quick-add of a
 * consult or session via the BookingDrawer. Presence is ephemeral local state;
 * bookings persist through the shared Phase-9 server actions.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarGrid, type CalendarEvent } from "@/components/admin/CalendarGrid";
import {
  BookingDrawer,
  type BookingDraft,
  type NamedOption,
} from "@/components/admin/BookingDrawer";
import type {
  BookingPayload,
  BookingType,
} from "@/components/admin/booking-form";
import { saveBookingAction } from "../calendar/actions";
import {
  currentBooking,
  nextBooking,
  type DeskArtist,
} from "./desk-board";

export interface FrontDeskClientProps {
  artists: DeskArtist[];
  customers: NamedOption[];
  /** ISO start-of-today, so the inline calendar anchors correctly. */
  todayISO: string;
}

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function FrontDeskClient({
  artists,
  customers,
  todayISO,
}: FrontDeskClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [present, setPresent] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(artists.map((a) => [a.id, !a.onLeave])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<BookingDraft | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const now = new Date();
  const selected = artists.find((a) => a.id === selectedId) ?? null;

  const selectedEvents: CalendarEvent[] = useMemo(
    () =>
      selected
        ? selected.bookings.map((b) => ({
            id: b.id,
            type: b.type as CalendarEvent["type"],
            title: b.type,
            start: b.start,
            end: b.end,
            status: b.status,
            customerName: b.customerName,
          }))
        : [],
    [selected],
  );

  function quickAdd(artistId: string, type: BookingType, startISO?: string) {
    setSelectedId(artistId);
    setDrawer({ artistId, type, start: startISO });
    setDrawerOpen(true);
  }

  async function handleSave(
    payload: BookingPayload,
  ): Promise<string | null> {
    const res = await saveBookingAction(payload);
    if (!res.ok) return res.error ?? "Could not save.";
    toast.success("Booking added");
    startTransition(() => router.refresh());
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <Toaster position="top-center" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((a) => {
          const cur = currentBooking(a.bookings, now);
          const nxt = nextBooking(a.bookings, now);
          const here = present[a.id];
          return (
            <Card
              key={a.id}
              className={cn(
                "border-border-default bg-bg-card transition-opacity",
                !here && "opacity-60",
                selectedId === a.id && "ring-1 ring-bb-gold",
              )}
            >
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className="text-left font-termina text-sm uppercase tracking-wide text-text-primary hover:underline"
                  >
                    {a.name}
                  </button>
                  <label className="flex items-center gap-2 text-xs text-text-muted">
                    {here ? "Present" : "Away"}
                    <Switch
                      checked={here}
                      onCheckedChange={(v) =>
                        setPresent((p) => ({ ...p, [a.id]: v }))
                      }
                      aria-label={`${a.name} presence`}
                    />
                  </label>
                </div>

                <dl className="space-y-1 text-sm">
                  <Row
                    label="Now"
                    value={
                      a.onLeave
                        ? "On leave"
                        : cur
                          ? `${cur.customerName} · until ${TIME.format(new Date(cur.end))}`
                          : "Free"
                    }
                  />
                  <Row
                    label="Next"
                    value={
                      nxt
                        ? `${TIME.format(new Date(nxt.start))} · ${nxt.customerName}`
                        : "—"
                    }
                  />
                </dl>

                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => quickAdd(a.id, "consult")}
                  >
                    <Plus />
                    Consult
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => quickAdd(a.id, "session")}
                  >
                    <Plus />
                    Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-termina text-sm uppercase tracking-wide text-text-secondary">
              {selected.name} · today
            </h2>
            <Button size="sm" onClick={() => quickAdd(selected.id, "session")}>
              <Plus />
              Quick add
            </Button>
          </div>
          <CalendarGrid
            artistId={selected.id}
            view="day"
            date={todayISO}
            events={selectedEvents}
            onCreate={(startISO) => quickAdd(selected.id, "session", startISO)}
          />
        </section>
      ) : (
        <p className="text-sm text-text-muted">
          Pick an artist to open their day and quick-add a client.
        </p>
      )}

      <BookingDrawer
        open={drawerOpen}
        booking={drawer}
        customers={customers}
        artists={artists.map((a) => ({ id: a.id, name: a.name }))}
        defaultArtistId={selectedId ?? undefined}
        onSave={handleSave}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-10 shrink-0 text-text-muted">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
