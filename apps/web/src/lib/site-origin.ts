import { headers } from "next/headers";

/**
 * The public site's origin + whether search engines may index it.
 *
 * APP_ORIGIN is the web app's own origin (WEB_ORIGIN in docker-compose.prod.yml)
 * and drives every absolute URL the site emits: sitemap, robots, canonical and
 * Open Graph links. Indexing is opt-in: only when PRODUCTION_ORIGIN is set AND
 * matches both APP_ORIGIN and the host the request actually arrived on is the
 * site indexable. Staging (or a preview domain, or a box with the variable
 * unset) therefore always answers robots `Disallow: /` and pages carry
 * `noindex`, even if it shares production's env file.
 */

const DEV_ORIGIN = "http://localhost:3000";

function normaliseOrigin(raw: string | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    return new URL(s).origin;
  } catch {
    return null;
  }
}

/** APP_ORIGIN without a trailing slash; localhost:3000 in dev when unset. */
export function siteOrigin(): string {
  return normaliseOrigin(process.env.APP_ORIGIN) ?? DEV_ORIGIN;
}

export interface IndexableInput {
  /** The site's configured origin (APP_ORIGIN). */
  appOrigin: string | undefined;
  /** PRODUCTION_ORIGIN — the one origin allowed into search indexes. */
  productionOrigin: string | undefined;
  /** Host header of the current request, when there is one. */
  requestHost?: string | null;
}

/** Pure decision behind siteIndexable(); see the module comment. */
export function isIndexable({
  appOrigin,
  productionOrigin,
  requestHost,
}: IndexableInput): boolean {
  const prod = normaliseOrigin(productionOrigin);
  const app = normaliseOrigin(appOrigin);
  if (!prod || !app || prod !== app) return false;
  if (requestHost) {
    const host = requestHost.split(",")[0].trim().toLowerCase();
    if (host !== new URL(prod).host) return false;
  }
  return true;
}

/** Whether the current request may be indexed (reads env + request host). */
export async function siteIndexable(): Promise<boolean> {
  let requestHost: string | null = null;
  try {
    const h = await headers();
    requestHost = h.get("x-forwarded-host") ?? h.get("host");
  } catch {
    // Outside a request (e.g. build-time prerender): decide on env alone.
  }
  return isIndexable({
    appOrigin: process.env.APP_ORIGIN,
    productionOrigin: process.env.PRODUCTION_ORIGIN,
    requestHost,
  });
}
