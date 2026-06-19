/**
 * Shared types + draft helpers for the unified Artist CMS editor. Split out of
 * ArtistEditor to keep each module under the size limit. Pure (client-safe).
 */

import { penceToPounds } from "../_lib/artist-form";
import type { ArtistStatus } from "@/lib/artist-status";

export interface StyleOption {
  id: string;
  name: string;
}

export interface ArtistRow {
  id: string;
  slug: string;
  name: string;
  status: ArtistStatus;
  email: string;
  accessRole: "OWNER" | "ARTIST";
  tag: string | null;
  bio: string | null;
  specials: string[];
  hourlyRatePence: number | null;
  dayRatePence: number | null;
  insta: string | null;
  headshot: string | null;
  hue: string | null;
  booksStatus: string;
  sortOrder: number;
  active: boolean;
  styleIds: string[];
}

export interface Draft {
  id: string | null;
  slug: string;
  name: string;
  status: ArtistStatus;
  email: string;
  accessRole: "OWNER" | "ARTIST";
  tag: string;
  bio: string;
  specials: string;
  hourlyRatePounds: string;
  dayRatePounds: string;
  insta: string;
  hue: string;
  booksStatus: string;
  sortOrder: number;
  active: boolean;
  styleIds: string[];
  headshot: string;
}

export const BOOKS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "limited", label: "Limited" },
  { value: "closed", label: "Closed" },
];

export function emptyDraft(): Draft {
  return {
    id: null,
    slug: "",
    name: "",
    status: "RESIDENT",
    email: "",
    accessRole: "ARTIST",
    tag: "",
    bio: "",
    specials: "",
    hourlyRatePounds: "",
    dayRatePounds: "",
    insta: "",
    hue: "",
    booksStatus: "open",
    sortOrder: 0,
    active: true,
    styleIds: [],
    headshot: "",
  };
}

export function fromRow(row: ArtistRow): Draft {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    email: row.email,
    accessRole: row.accessRole,
    tag: row.tag ?? "",
    bio: row.bio ?? "",
    specials: row.specials.join(", "),
    hourlyRatePounds: penceToPounds(row.hourlyRatePence),
    dayRatePounds: penceToPounds(row.dayRatePence),
    insta: row.insta ?? "",
    hue: row.hue ?? "",
    booksStatus: row.booksStatus,
    sortOrder: row.sortOrder,
    active: row.active,
    styleIds: [...row.styleIds],
    headshot: row.headshot ?? "",
  };
}

/** Build the FormData submitted to the create/update server action. */
export function draftToFormData(draft: Draft, isNew: boolean): FormData {
  const fd = new FormData();
  if (!isNew && draft.id) fd.set("id", draft.id);
  fd.set("slug", draft.slug);
  fd.set("name", draft.name);
  fd.set("status", draft.status);
  fd.set("tag", draft.tag);
  fd.set("bio", draft.bio);
  fd.set("specials", draft.specials);
  fd.set("hourlyRatePounds", draft.hourlyRatePounds);
  fd.set("dayRatePounds", draft.dayRatePounds);
  fd.set("insta", draft.insta);
  fd.set("headshot", draft.headshot);
  fd.set("hue", draft.hue);
  fd.set("booksStatus", draft.booksStatus);
  fd.set("sortOrder", String(draft.sortOrder));
  if (draft.active) fd.set("active", "on");
  for (const id of draft.styleIds) fd.append("styleIds", id);
  if (isNew) {
    fd.set("email", draft.email);
    fd.set("accessRole", draft.accessRole);
  }
  return fd;
}

export function rateCell(pence: number | null): string {
  return pence == null ? "—" : `£${penceToPounds(pence)}`;
}
