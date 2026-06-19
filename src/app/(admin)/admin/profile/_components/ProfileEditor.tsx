"use client";

import { useState } from "react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { artistStatusLabel, type ArtistStatus } from "@bnb/core/artist-status";

/**
 * Own artist profile + portfolio editor (L1). The signed-in artist edits their
 * bio, socials, numeric £ rates and styles (a checkbox multiselect bound to the
 * TattooStyle list). Their `status` (title) is read-only here — only an owner
 * changes it from Content › Artists. The headshot + style ids are mirrored into
 * hidden/checkbox inputs so the server action receives them in the FormData.
 */

export interface StyleOption {
  id: string;
  name: string;
}

export interface ProfileEditorValues {
  status: ArtistStatus;
  bio: string | null;
  insta: string | null;
  headshot: string | null;
  hourlyRatePence: number | null;
  dayRatePence: number | null;
  selectedStyleIds: string[];
  specials: string[];
}

function pounds(pence: number | null): string {
  if (pence == null) return "";
  return (pence / 100) % 1 === 0
    ? String(pence / 100)
    : (pence / 100).toFixed(2);
}

export function ProfileEditor({
  values,
  styles,
  action,
}: {
  values: ProfileEditorValues;
  styles: StyleOption[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [headshot, setHeadshot] = useState(values.headshot ?? "");

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <input type="hidden" name="headshot" value={headshot} />

      <div>
        <Label className="mb-1.5 block">Status</Label>
        <p className="rounded-md border border-border-default bg-bg-raised px-3 py-2 text-sm text-text-secondary">
          {artistStatusLabel(values.status)}
          <span className="ml-2 text-xs text-text-muted">
            (set by an owner in Content › Artists)
          </span>
        </p>
      </div>

      <div>
        <Label className="mb-1.5 block">Headshot</Label>
        <ImageUploader
          value={headshot}
          onChange={(v) => setHeadshot(Array.isArray(v) ? (v[0] ?? "") : v)}
          label="Upload headshot"
        />
      </div>

      <div>
        <Label htmlFor="bio" className="mb-1.5 block">
          Bio
        </Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={values.bio ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="hourlyRatePounds" className="mb-1.5 block">
            Hourly rate (£)
          </Label>
          <Input
            id="hourlyRatePounds"
            name="hourlyRatePounds"
            type="number"
            step="0.01"
            min="0"
            defaultValue={pounds(values.hourlyRatePence)}
          />
        </div>
        <div>
          <Label htmlFor="dayRatePounds" className="mb-1.5 block">
            Day rate (£)
          </Label>
          <Input
            id="dayRatePounds"
            name="dayRatePounds"
            type="number"
            step="0.01"
            min="0"
            defaultValue={pounds(values.dayRatePence)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="insta" className="mb-1.5 block">
          Instagram
        </Label>
        <Input id="insta" name="insta" defaultValue={values.insta ?? ""} />
      </div>

      <div>
        <Label className="mb-1.5 block">Styles</Label>
        <div className="flex flex-wrap gap-2">
          {styles.length === 0 && (
            <p className="text-sm text-text-muted">
              No tattoo styles defined yet.
            </p>
          )}
          {styles.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-raised px-2.5 py-1.5 text-sm text-text-secondary"
            >
              <input
                type="checkbox"
                name="styleIds"
                value={s.id}
                defaultChecked={values.selectedStyleIds.includes(s.id)}
                className="h-4 w-4 rounded border-border-strong"
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="specials" className="mb-1.5 block">
          Specials (comma separated)
        </Label>
        <Input
          id="specials"
          name="specials"
          defaultValue={values.specials.join(", ")}
        />
      </div>

      <Button type="submit">Save profile</Button>
    </form>
  );
}
