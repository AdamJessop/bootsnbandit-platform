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
  return (fromEnv && fromEnv.replace(/\/$/, "")) || "https://bootsnbandit.co.uk";
}

/** pence -> "£12.34" */
export function formatGBP(pence: number): string {
  const safe = Number.isFinite(pence) ? pence : 0;
  return `£${(safe / 100).toFixed(2)}`;
}
