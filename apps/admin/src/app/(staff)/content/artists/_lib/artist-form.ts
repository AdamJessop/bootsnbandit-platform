/**
 * Pure coercion for the unified Artist CMS (no server-only imports → unit
 * testable). Maps the artist form's FormData (status enum, style-id multiselect,
 * numeric £ rate inputs, access role + email for the unified create) into a
 * prisma-shaped profile payload plus the selected style ids and the User halves.
 */

import type { ArtistStatus } from "@bnb/core/artist-status";
import { poundsToPence } from "../../_lib/money";

// Re-exported so existing importers/tests of the artist form keep working;
// the helpers now live in the shared content money module.
export { poundsToPence, penceToPounds } from "../../_lib/money";

export type AccessRole = "OWNER" | "ARTIST";
export type BooksStatus = "open" | "limited" | "closed";

const STATUSES: ReadonlyArray<ArtistStatus> = [
  "CO_OWNER",
  "RESIDENT",
  "APPRENTICE",
];
const BOOKS: ReadonlyArray<BooksStatus> = ["open", "limited", "closed"];

export interface ArtistProfilePayload {
  slug: string;
  name: string;
  status: ArtistStatus;
  tag: string | null;
  bio: string | null;
  specials: string[];
  hourlyRatePence: number | null;
  dayRatePence: number | null;
  insta: string | null;
  headshot: string | null;
  hue: string | null;
  booksStatus: BooksStatus;
  sortOrder: number;
  active: boolean;
}

export interface CoercedArtist {
  profile: ArtistProfilePayload;
  styleIds: string[];
  /** User halves — only used when creating a new artist+user. */
  email: string | null;
  accessRole: AccessRole;
}

function str(fd: FormData, key: string): string {
  const raw = fd.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullable(fd: FormData, key: string): string | null {
  const s = str(fd, key);
  return s === "" ? null : s;
}

function csv(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function int(fd: FormData, key: string): number {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function status(fd: FormData): ArtistStatus {
  const s = str(fd, "status") as ArtistStatus;
  return STATUSES.includes(s) ? s : "RESIDENT";
}

function books(fd: FormData): BooksStatus {
  const s = str(fd, "booksStatus") as BooksStatus;
  return BOOKS.includes(s) ? s : "open";
}

export function coerceArtist(fd: FormData): CoercedArtist {
  const accessRole: AccessRole =
    str(fd, "accessRole") === "OWNER" ? "OWNER" : "ARTIST";
  return {
    profile: {
      slug: str(fd, "slug"),
      name: str(fd, "name"),
      status: status(fd),
      tag: nullable(fd, "tag"),
      bio: nullable(fd, "bio"),
      specials: csv(fd, "specials"),
      hourlyRatePence: poundsToPence(str(fd, "hourlyRatePounds")),
      dayRatePence: poundsToPence(str(fd, "dayRatePounds")),
      insta: nullable(fd, "insta"),
      headshot: nullable(fd, "headshot"),
      hue: nullable(fd, "hue"),
      booksStatus: books(fd),
      sortOrder: int(fd, "sortOrder"),
      active: str(fd, "active") === "on" || str(fd, "active") === "true",
    },
    styleIds: fd
      .getAll("styleIds")
      .filter((v): v is string => typeof v === "string"),
    email: nullable(fd, "email"),
    accessRole,
  };
}

/** Slugify a display name into a URL slug (fallback when none supplied). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Deliberately loose (x@y.z) — the sign-in invite is the real check. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server-side validation for an artist save: the first problem as an
 * owner-facing sentence, or null. Mirrors the editor's disabled-Save rules so
 * a blank name can never persist as "".
 */
export function artistInputError(
  input: CoercedArtist,
  isNew: boolean,
): string | null {
  if (!input.profile.name) return "Name is required.";
  if (!slugify(input.profile.slug || input.profile.name)) {
    return "The slug needs at least one letter or number.";
  }
  if (isNew) {
    if (!input.email) return "Email is required to create the staff account.";
    if (!EMAIL_RE.test(input.email)) return "That email doesn't look right.";
  }
  return null;
}
