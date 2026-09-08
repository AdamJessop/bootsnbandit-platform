"use client";

/**
 * The Actions view: the three decisions an enquiry is waiting on — who owns
 * it, whether it becomes a consult, and whether it is done. Split out of the
 * old dialog's EnquiryMeta so the conversation and the brief never share a
 * scroll with a form. Every authorisation decision belongs to the server
 * actions, not to this island.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
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
import { isUnassigned } from "../enquiry-helpers";
import { useAction, type ArtistOption, type EnquiryItem } from "../inbox-shared";
import {
  assignEnquiry,
  claimEnquiry,
  closeEnquiry,
  convertEnquiry,
} from "../actions";

export interface EnquiryActionsProps {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  /** The viewing artist's id, or null for owners. */
  viewerArtistId: string | null;
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-border-default py-6 first:border-t-0 first:pt-0 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <div>
        <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{hint}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function EnquiryActions({
  item,
  artists,
  canConvert,
  viewerArtistId,
}: EnquiryActionsProps) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [artistId, setArtistId] = useState(item.preferredArtistId ?? "");
  const [startISO, setStartISO] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const artistItems = useMemo(
    () => artists.map((a) => ({ value: a.id, label: a.name })),
    [artists],
  );
  const refresh = () => router.refresh();
  const unassigned = isUnassigned(item);
  const closed = item.status === "closed";

  return (
    <div>
      <Step
        title="Who's taking it"
        hint={
          unassigned
            ? "Nobody yet. Replying claims it; or hand it to someone."
            : `${item.preferredArtistName} has it.`
        }
      >
        {viewerArtistId && unassigned && (
          <Button
            disabled={pending}
            onClick={() => run(() => claimEnquiry(item.id), { onSuccess: refresh })}
          >
            Take this enquiry
          </Button>
        )}
        <div className="flex gap-2">
          <Select
            items={artistItems}
            value={artistId}
            onValueChange={(v) => setArtistId(v ?? "")}
          >
            <SelectTrigger className="min-h-11 flex-1" aria-label="Artist">
              <SelectValue placeholder="Choose artist" />
            </SelectTrigger>
            <SelectContent>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending || !artistId || artistId === item.preferredArtistId}
            onClick={() =>
              run(() => assignEnquiry(item.id, artistId), { onSuccess: refresh })
            }
          >
            Assign
          </Button>
        </div>
      </Step>

      {canConvert && (
        <Step
          title="Book a consult"
          hint="A free 15-minute chat, put straight in the calendar."
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
            <div className="space-y-1">
              <Label htmlFor="consult-start">Start</Label>
              {/*
                The browser's picker stays reachable (its indicator is
                stretched over the right edge, invisible) while the world's
                own glyph is what staff see.
              */}
              <div className="relative">
                <Input
                  id="consult-start"
                  type="datetime-local"
                  className="min-h-11 pr-10 tabular-nums text-text-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  onChange={(e) =>
                    setStartISO(
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    )
                  }
                />
                <CalendarClock
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
                  aria-hidden
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="consult-duration">Minutes</Label>
              <Input
                id="consult-duration"
                type="number"
                className="min-h-11 tabular-nums"
                value={durationMin}
                min={15}
                step={15}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
          </div>
          {!artistId && (
            <p className="text-sm text-bb-gold">Pick an artist first.</p>
          )}
          <Button
            className="min-h-11"
            disabled={pending || !startISO || !artistId}
            onClick={() =>
              run(
                () =>
                  convertEnquiry(item.id, {
                    artistId,
                    startISO,
                    durationMin: Number(durationMin),
                    type: "consult",
                  }),
                { onSuccess: refresh },
              )
            }
          >
            Create consult
          </Button>
        </Step>
      )}

      <Step
        title="Finished with it"
        hint={
          closed
            ? "This enquiry is closed."
            : "Closing hides it from the live tabs. The thread stays on the customer's record."
        }
      >
        <Button
          variant="outline"
          className="min-h-11 border-bb-crimson/40 text-bb-crimson hover:bg-bb-crimson/10 hover:text-bb-crimson"
          disabled={pending || closed}
          onClick={() =>
            run(() => closeEnquiry(item.id), {
              onSuccess: () => router.push("/enquiries"),
            })
          }
        >
          {closed ? "Closed" : "Close enquiry"}
        </Button>
      </Step>
    </div>
  );
}
