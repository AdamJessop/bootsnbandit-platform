"use client";

/**
 * The non-conversation half of the detail dialog: the brief, the mood board,
 * and the triage controls (take, assign, convert → booking, close). Owns its
 * own transition so a slow assign cannot block the composer next to it.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
import { formatPence } from "@/components/admin/money";
import {
  MoodBoardBriefSection,
  MoodboardSection,
} from "./EnquiryDetailSections";
import { isUnassigned } from "./enquiry-helpers";
import { useAction, type ArtistOption, type EnquiryItem } from "./inbox-shared";
import {
  assignEnquiry,
  claimEnquiry,
  closeEnquiry,
  convertEnquiry,
} from "./actions";

export interface EnquiryMetaProps {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  /** The viewing artist's id, or null for owners. */
  viewerArtistId: string | null;
  /** Called after an action that finishes the job, so the dialog can close. */
  onDone: () => void;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="text-text-secondary">{value || "—"}</dd>
    </div>
  );
}

export function EnquiryMeta({
  item,
  artists,
  canConvert,
  viewerArtistId,
  onDone,
}: EnquiryMetaProps) {
  const { pending, run } = useAction();
  const [artistId, setArtistId] = useState(item.preferredArtistId ?? "");
  const [startISO, setStartISO] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  // Lets the closed assign-select trigger render the artist's name, not the cuid.
  const artistItems = useMemo(
    () => artists.map((a) => ({ value: a.id, label: a.name })),
    [artists],
  );

  return (
    <>
      {/*
        The way out of the inbox and into everything it deliberately does not
        carry: this person's older enquiries, their bookings, their notes.
        Absent when the lead has no customer record yet — an unreconciled web
        form — rather than rendered as a dead link.
      */}
      {item.customerId && (
        <Link
          href={`/customers/${item.customerId}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
        >
          View customer <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Style" value={item.style} />
        <Field label="Placement" value={item.placement} />
        <Field label="Size" value={item.size} />
        <Field
          label="Budget"
          value={
            item.budgetPence != null ? formatPence(item.budgetPence) : null
          }
        />
      </dl>
      {item.description && (
        <p className="rounded-md border border-border-default bg-bg-base p-3 text-sm text-text-secondary">
          {item.description}
        </p>
      )}

      <MoodBoardBriefSection data={item.moodboardData} />
      <MoodboardSection urls={item.moodboard} data={item.moodboardData} />

      {viewerArtistId && isUnassigned(item) && (
        <Button
          disabled={pending}
          onClick={() =>
            run(() => claimEnquiry(item.id), { onSuccess: onDone })
          }
        >
          Take this enquiry
        </Button>
      )}

      {/* Assign */}
      <section className="space-y-2">
        <Label>Assign artist</Label>
        <div className="flex gap-2">
          <Select
            items={artistItems}
            value={artistId}
            onValueChange={(v) => setArtistId(v ?? "")}
          >
            <SelectTrigger className="flex-1">
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
            disabled={pending || !artistId}
            onClick={() =>
              run(() => assignEnquiry(item.id, artistId), { onSuccess: onDone })
            }
          >
            Assign
          </Button>
        </div>
      </section>

      {/* Convert */}
      {canConvert && (
        <section className="space-y-2 rounded-md border border-border-default p-3">
          <Label>Convert → booking</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="datetime-local"
              aria-label="Start"
              onChange={(e) =>
                setStartISO(
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                )
              }
            />
            <Input
              type="number"
              aria-label="Duration (minutes)"
              value={durationMin}
              min={15}
              step={15}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>
          <Button
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
                { onSuccess: onDone },
              )
            }
          >
            Create consult
          </Button>
        </section>
      )}

      {item.status !== "closed" && (
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() =>
            run(() => closeEnquiry(item.id), { onSuccess: onDone })
          }
        >
          Close enquiry
        </Button>
      )}
    </>
  );
}
