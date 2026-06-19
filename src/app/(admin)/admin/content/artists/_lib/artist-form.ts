/**
 * Pure coercion for the unified Artist CMS (no server-only imports → unit
 * testable). Maps the artist form's FormData (status enum, style-id multiselect,
 * numeric £ rate inputs, access role + email for the unified create) into a
 * prisma-shaped profile payload plus the selected style ids and the User halves.
 */

import type { ArtistStatus } from "@/lib/artist-status";

export type AccessRole = "OWNER" | "ARTIST";
export type BooksStatus = "open" | "limited" | "closed";

const STATUSES: ReadonlyArray<ArtistStatus> = [
  "CO_OWNER",
  "RESIDENT",
  "APPRENTICE",
];
const BOOKS: ReadonlyArray<BooksStatus> = ["open", "limited", "closed"];

/** £ string ("90", "90.50") → integer pence, or null for blank/invalid. */
export function poundsToPence(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Integer pence → a £ string suitable for a number input (no symbol). */
export function penceToPounds(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100) % 1 === 0
    ? String(pence / 100)
    : (pence / 100).toFixed(2);
}

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
