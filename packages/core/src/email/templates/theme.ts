/**
 * Email-safe heritage palette + studio facts shared by all templates.
 * Kept deliberately small and inline-friendly (email clients strip <style>).
 */
export const colors = {
  crimson: "#c92f4d",
  gold: "#cfa05a",
  ink: "#1a1714",
  body: "#3a342c",
  muted: "#7a7264",
  bg: "#f6f1e8",
  card: "#ffffff",
  border: "#e7ddcd",
} as const;

export const studio = {
  name: "Boots 'n' Bandit",
  tagline: "Tattoo Studio",
  address: "67 Newcastle Avenue, Worksop, S80 1LX",
  hours: "Tue–Sat 10am–6pm",
} as const;

/** App origin for building absolute links; falls back to the live-ish default. */
export function appOrigin(): string {
  const fromEnv = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL;
  return (
    (fromEnv && fromEnv.replace(/\/$/, "")) || "https://bootsnbandit.co.uk"
  );
}

/**
 * Public web-site origin for CUSTOMER-facing links (aftercare guide, review
 * pages…). Emails are sent from the admin app, whose APP_ORIGIN points at
 * admin.<domain> where those pages don't exist — so customer links must use
 * the public site's origin instead. Staff-facing links keep `appOrigin()`.
 */
export function publicSiteOrigin(): string {
  const fromEnv = process.env.PUBLIC_SITE_ORIGIN;
  return (fromEnv && fromEnv.replace(/\/$/, "")) || "http://localhost:3000";
}

/** pence -> "£12.34" */
export function formatGBP(pence: number): string {
  const safe = Number.isFinite(pence) ? pence : 0;
  return `£${(safe / 100).toFixed(2)}`;
}
