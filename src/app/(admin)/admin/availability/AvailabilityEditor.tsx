"use client";

/**
 * Availability & Leave editor (BACKOFHOUSE-IA H1/H2). Weekly working hours
 * (PUT /api/availability) and a leave/annual-leave declaration that marks the
 * artist unavailable (POST /api/leave, approved → blocks the calendar). Owners
 * pick an artist; artists edit themselves. Reloads availability on artist
 * switch.
 */
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  WEEKDAYS,
  rulesToWeekState,
  validateDay,
  weekStateToRules,
  type AvailabilityRule,
  type WeekState,
} from "./availability-helpers";

export interface AvailabilityArtist {
  id: string;
  name: string;
}

export function AvailabilityEditor({
  artists,
  initialArtistId,
  initialRules,
  lockArtist,
}: {
  artists: AvailabilityArtist[];
  initialArtistId: string;
  initialRules: AvailabilityRule[];
  /** Artists cannot switch the selected artist. */
  lockArtist: boolean;
}) {
  const [artistId, setArtistId] = useState(initialArtistId);
  const [week, setWeek] = useState<WeekState>(() =>
    rulesToWeekState(initialRules),
  );
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, start] = useTransition();

  // Reload availability when the owner switches artist.
  useEffect(() => {
    if (artistId === initialArtistId) return;
    let active = true;
    fetch(`/api/availability?artistId=${encodeURIComponent(artistId)}`)
      .then((r) => r.json())
      .then((data: { rules?: AvailabilityRule[] }) => {
        if (active) setWeek(rulesToWeekState(data.rules ?? []));
      })
      .catch(() => toast.error("Could not load availability."));
    return () => {
      active = false;
    };
  }, [artistId, initialArtistId]);

  function patchDay(weekday: number, patch: Partial<WeekState[number]>) {
    setWeek((prev) =>
      prev.map((d, i) => (i === weekday ? { ...d, ...patch } : d)),
    );
  }

  function saveHours() {
    if (!week.every(validateDay)) {
      toast.error("Each enabled day must end after it starts.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId, rules: weekStateToRules(week) }),
      });
      toast[res.ok ? "success" : "error"](
        res.ok ? "Working hours saved." : "Could not save working hours.",
      );
    });
  }

  function declareLeave() {
    if (!from || !to) {
      toast.error("Pick a start and end date.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          startDate: new Date(from).toISOString(),
          endDate: new Date(to).toISOString(),
          reason: reason || null,
        }),
      });
      if (res.ok) {
        setReason("");
        setFrom("");
        setTo("");
        toast.success("Leave declared — calendar marked unavailable.");
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error ?? "Could not declare leave.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {!lockArtist && artists.length > 1 && (
        <div className="max-w-xs space-y-1.5">
          <Label>Artist</Label>
          <Select
            value={artistId}
            onValueChange={(v) => setArtistId(v ?? initialArtistId)}
          >
            <SelectTrigger>
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
        </div>
      )}

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="font-termina text-xs uppercase tracking-wide text-text-muted">
          Weekly working hours
        </h2>
        <div className="mt-4 space-y-2">
          {WEEKDAYS.map((d) => {
            const day = week[d.weekday];
            return (
              <div
                key={d.weekday}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border-default px-3 py-2"
              >
                <div className="flex w-24 items-center gap-2">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(enabled) =>
                      patchDay(d.weekday, { enabled })
                    }
                    aria-label={`${d.label} enabled`}
                  />
                  <span className="text-sm text-text-secondary">{d.label}</span>
                </div>
                <Input
                  type="time"
                  value={day.start}
                  disabled={!day.enabled}
                  onChange={(e) => patchDay(d.weekday, { start: e.target.value })}
                  className="w-32 tabular-nums"
                  aria-label={`${d.label} start`}
                />
                <span className="text-text-muted">–</span>
                <Input
                  type="time"
                  value={day.end}
                  disabled={!day.enabled}
                  onChange={(e) => patchDay(d.weekday, { end: e.target.value })}
                  className="w-32 tabular-nums"
                  aria-label={`${d.label} end`}
                />
              </div>
            );
          })}
        </div>
        <Button className="mt-4" onClick={saveHours} disabled={pending}>
          Save working hours
        </Button>
      </section>

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="font-termina text-xs uppercase tracking-wide text-text-muted">
          Declare leave
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Annual leave, training or sickness — blocks new bookings in the range.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="leave-from">From</Label>
            <Input
              id="leave-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-to">To</Label>
            <Input
              id="leave-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="leave-reason">Reason (optional)</Label>
          <Textarea
            id="leave-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button className="mt-4" onClick={declareLeave} disabled={pending}>
          Declare leave
        </Button>
      </section>
      <Toaster position="top-center" />
    </div>
  );
}
