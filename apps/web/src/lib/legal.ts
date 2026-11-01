/**
 * Fixed facts shared by the /privacy and /data-deletion pages. Hardcoded
 * rather than read from the CMS SiteSettings: Meta reviews these URLs, and a
 * policy's contact address and date must not change when someone edits the
 * studio email in the admin.
 */
export const PRIVACY_EMAIL = "studio@bootsnbandit.com";

/** Shown as "Last updated" on both pages; bump it with any policy change. */
export const POLICY_UPDATED = "1 November 2026";

/** Days we allow ourselves to complete a deletion request. */
export const DELETION_DAYS = 30;

/** Footer links to the legal pages (kept off the main nav). */
export const LEGAL_NAV = [
  { label: "Privacy", href: "/privacy" },
  { label: "Data deletion", href: "/data-deletion" },
] as const;
