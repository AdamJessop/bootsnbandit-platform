"use client";

import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ARTIST_STATUS_OPTIONS, type ArtistStatus } from "@bnb/core/artist-status";
import { BOOKS_OPTIONS, type Draft, type StyleOption } from "./artist-draft";

/**
 * The inline create/edit form body for the Artist CMS. On create it also
 * collects the linked staff User's email + access role; on edit those are
 * immutable (managed in Studio › Staff). Status uses the shared enum options,
 * styles are a checkbox multiselect bound to the TattooStyle list, and the two
 * rate inputs are numeric £ (the parent converts to pence).
 */

const selectCls =
  "h-10 w-full rounded-md border border-border-default bg-bg-raised px-3 text-sm text-text-primary";

export interface ArtistFormProps {
  draft: Draft;
  styles: StyleOption[];
  isNew: boolean;
  pending: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onToggleStyle: (id: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ArtistForm({
  draft,
  styles,
  isNew,
  pending,
  onChange,
  onToggleStyle,
  onSubmit,
  onCancel,
}: ArtistFormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="ae-name" className="mb-1.5 block">
          Name
        </Label>
        <Input
          id="ae-name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="ae-slug" className="mb-1.5 block">
          Slug
        </Label>
        <Input
          id="ae-slug"
          value={draft.slug}
          placeholder="auto from name"
          onChange={(e) => onChange({ slug: e.target.value })}
        />
      </div>

      {isNew && (
        <>
          <div>
            <Label htmlFor="ae-email" className="mb-1.5 block">
              Account email
            </Label>
            <Input
              id="ae-email"
              name="email"
              type="email"
              value={draft.email}
              placeholder="artist@bootsnbandit.co.uk"
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="ae-accessRole" className="mb-1.5 block">
              Access role
            </Label>
            <select
              id="ae-accessRole"
              name="accessRole"
              value={draft.accessRole}
              onChange={(e) =>
                onChange({ accessRole: e.target.value as "OWNER" | "ARTIST" })
              }
              className={selectCls}
            >
              <option value="ARTIST">Artist</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="ae-status" className="mb-1.5 block">
          Status
        </Label>
        <select
          id="ae-status"
          name="status"
          value={draft.status}
          onChange={(e) => onChange({ status: e.target.value as ArtistStatus })}
          className={selectCls}
        >
          {ARTIST_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="ae-books" className="mb-1.5 block">
          Books
        </Label>
        <select
          id="ae-books"
          value={draft.booksStatus}
          onChange={(e) => onChange({ booksStatus: e.target.value })}
          className={selectCls}
        >
          {BOOKS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="ae-hourly" className="mb-1.5 block">
          Hourly rate (£)
        </Label>
        <Input
          id="ae-hourly"
          name="hourlyRatePounds"
          type="number"
          step="0.01"
          min="0"
          value={draft.hourlyRatePounds}
          onChange={(e) => onChange({ hourlyRatePounds: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="ae-day" className="mb-1.5 block">
          Day rate (£)
        </Label>
        <Input
          id="ae-day"
          name="dayRatePounds"
          type="number"
          step="0.01"
          min="0"
          value={draft.dayRatePounds}
          onChange={(e) => onChange({ dayRatePounds: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="ae-tag" className="mb-1.5 block">
          Tag
        </Label>
        <Input
          id="ae-tag"
          value={draft.tag}
          onChange={(e) => onChange({ tag: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="ae-insta" className="mb-1.5 block">
          Instagram
        </Label>
        <Input
          id="ae-insta"
          value={draft.insta}
          onChange={(e) => onChange({ insta: e.target.value })}
        />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="ae-bio" className="mb-1.5 block">
          Bio
        </Label>
        <Textarea
          id="ae-bio"
          value={draft.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
        />
      </div>

      <div className="sm:col-span-2">
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
                value={s.id}
                checked={draft.styleIds.includes(s.id)}
                onChange={() => onToggleStyle(s.id)}
                className="h-4 w-4 rounded border-border-strong"
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="ae-specials" className="mb-1.5 block">
          Specials (comma separated)
        </Label>
        <Input
          id="ae-specials"
          value={draft.specials}
          onChange={(e) => onChange({ specials: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="ae-hue" className="mb-1.5 block">
          Hue
        </Label>
        <Input
          id="ae-hue"
          value={draft.hue}
          onChange={(e) => onChange({ hue: e.target.value })}
        />
      </div>

      <div className="sm:col-span-2">
        <Label className="mb-1.5 block">Headshot</Label>
        <ImageUploader
          value={draft.headshot}
          onChange={(v) =>
            onChange({ headshot: Array.isArray(v) ? (v[0] ?? "") : v })
          }
        />
      </div>

      <div>
        <Label htmlFor="ae-order" className="mb-1.5 block">
          Order
        </Label>
        <Input
          id="ae-order"
          type="number"
          value={String(draft.sortOrder)}
          onChange={(e) => onChange({ sortOrder: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-end gap-2">
        <input
          id="ae-active"
          type="checkbox"
          checked={draft.active}
          onChange={(e) => onChange({ active: e.target.checked })}
          className="h-5 w-5 rounded border-border-strong"
        />
        <Label htmlFor="ae-active">Active</Label>
      </div>

      <div className="mt-2 flex gap-2 sm:col-span-2">
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
