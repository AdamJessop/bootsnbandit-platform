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
