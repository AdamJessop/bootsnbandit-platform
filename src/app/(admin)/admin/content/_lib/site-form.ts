/**
 * Pure parsing helpers for the Site Settings editor (J8). Coerces the form into
 * the `SiteSettings` shape; ticker lines are one-per-textarea-row. Kept free of
 * server-only imports so it is unit testable.
 */

export interface SiteFormValues {
  studioName: string;
  addressLine: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  hoursText: string | null;
  phone: string | null;
  email: string | null;
  licensingText: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tickerLines: string[];
  enquiriesOpen: boolean;
  visualDirection: string;
}

/** Split a textarea into trimmed, non-empty ticker lines. */
export function parseTickerLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function str(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

const DIRECTIONS = new Set(["heritage", "noir", "grit"]);

/** Coerce the site-settings form's FormData into typed, validated values. */
export function parseSiteForm(fd: FormData): SiteFormValues {
  const studioName = str(fd, "studioName");
  if (!studioName) throw new Error("Studio name is required");

  const directionRaw = str(fd, "visualDirection");
  const visualDirection =
    directionRaw && DIRECTIONS.has(directionRaw) ? directionRaw : "heritage";

  const tickerRaw = fd.get("tickerText");
  const tickerLines =
    typeof tickerRaw === "string" ? parseTickerLines(tickerRaw) : [];

  return {
    studioName,
    addressLine: str(fd, "addressLine"),
    city: str(fd, "city"),
    county: str(fd, "county"),
    postcode: str(fd, "postcode"),
    hoursText: str(fd, "hoursText"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    licensingText: str(fd, "licensingText"),
    facebookUrl: str(fd, "facebookUrl"),
    instagramUrl: str(fd, "instagramUrl"),
    tickerLines,
    enquiriesOpen: fd.get("enquiriesOpen") === "on" || fd.get("enquiriesOpen") === "true",
    visualDirection,
  };
}
