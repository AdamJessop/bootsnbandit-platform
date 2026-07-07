/**
 * Public site navigation registry. Drives the desktop Nav links, the mobile
 * burger menu and the footer "Explore" column. Routes are placeholders until
 * the marketing pages land in Wave 4 (Phases 7/8).
 */
export interface SiteNavItem {
  label: string;
  href: string;
}

export const SITE_NAV: SiteNavItem[] = [
  { label: "Home", href: "/" },
  { label: "Artists", href: "/artists" },
  { label: "Gallery", href: "/gallery" },
  { label: "Inkling", href: "/inkling" },
  { label: "Enquire", href: "/enquire" },
  { label: "Flash", href: "/flash" },
  { label: "Aftercare", href: "/aftercare" },
  { label: "Studio", href: "/studio" },
  { label: "Sign in", href: "/account/sign-in" },
];

export const STUDIO = {
  name: "Boots 'n' Bandit",
  tagline: "Tattoo Studio",
  address: "67 Newcastle Avenue, Worksop, S80 1LX",
  hours: "Tue–Sat 10am–6pm",
  phone: "01909 000 000",
  instagram: "https://instagram.com/bootsnbandit",
  facebook: "https://facebook.com/bootsnbandit",
} as const;

/** Ticker marquee lines shown above the nav. */
export const TICKER_LINES: string[] = [
  "Books open · now taking Summer 2026",
  "New flash every Friday at 6pm",
  "Free 15-minute consultations every week",
  "Fully licensed · single-use needles · hospital-grade sterilisation",
];

/** The CMS SiteSettings fields the shell (Ticker/Footer) cares about. */
export interface ShellSettingsInput {
  studioName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  hoursText?: string | null;
  phone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tickerLines?: string[] | null;
}

export interface ShellSettings {
  name: string;
  address: string;
  hours: string;
  phone: string;
  instagram: string;
  facebook: string;
  tickerLines: string[];
}

/**
 * Merge the CMS SiteSettings row over the hardcoded STUDIO/TICKER_LINES
 * constants. Empty/missing CMS fields fall back per-field, so a partially
 * filled settings row never blanks part of the shell. Null input (no DB row,
 * or the DB unreachable at build time) yields the pure fallbacks.
 */
export function mergeShellSettings(
  s: ShellSettingsInput | null | undefined,
): ShellSettings {
  const address = [s?.addressLine, s?.city, s?.county, s?.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const tickerLines = (s?.tickerLines ?? []).filter((l) => l.trim().length > 0);
  return {
    name: s?.studioName?.trim() || STUDIO.name,
    address: address || STUDIO.address,
    hours: s?.hoursText?.trim() || STUDIO.hours,
    phone: s?.phone?.trim() || STUDIO.phone,
    instagram: s?.instagramUrl?.trim() || STUDIO.instagram,
    facebook: s?.facebookUrl?.trim() || STUDIO.facebook,
    tickerLines: tickerLines.length > 0 ? tickerLines : TICKER_LINES,
  };
}
