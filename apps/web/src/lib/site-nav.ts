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

/**
 * Confirmed studio facts used when the CMS is empty. There is deliberately no
 * phone number or social link here: those only appear once the owner enters
 * them in SiteSettings, so the site never shows an invented contact.
 */
export const STUDIO = {
  name: "Boots 'n' Bandit",
  tagline: "Tattoo Studio",
  address: "67 Newcastle Avenue, Worksop, S80 1LX",
  hours: "Tue–Sat 10am–6pm",
} as const;

/**
 * Ticker marquee lines shown above the nav when the CMS has none. Kept
 * season-neutral: books status and drop dates belong in the CMS.
 */
export const TICKER_LINES: string[] = [
  "Free 15-minute consultations every week",
  "Flash drops · claim a one-off design",
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
  /** Null until the owner sets one in the CMS — the shell hides the link. */
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  tickerLines: string[];
}

/**
 * Merge the CMS SiteSettings row over the hardcoded STUDIO/TICKER_LINES
 * constants. Empty/missing CMS fields fall back per-field, so a partially
 * filled settings row never blanks part of the shell. Null input (no DB row,
 * or the DB unreachable) yields the pure fallbacks. Phone and social links
 * have no fallback: empty stays null and the shell leaves them out.
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
    phone: s?.phone?.trim() || null,
    instagram: s?.instagramUrl?.trim() || null,
    facebook: s?.facebookUrl?.trim() || null,
    tickerLines: tickerLines.length > 0 ? tickerLines : TICKER_LINES,
  };
}
