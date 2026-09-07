import { prisma } from "@bnb/core/db";
import type { BoardColour } from "./moodboard-data";

/**
 * Inkling inspiration search: a deterministic query built from the visitor's
 * brief, run against (a) the studio's own gallery and (b) a web image-search
 * provider (Brave Search images; Google Programmable Search kept as legacy). The provider sits behind a tiny
 * interface so it can be swapped; results are cached in-process to protect
 * the daily quota. No AI.
 */

export interface InspirationBrief {
  styles: string[];
  colour: BoardColour | null;
  description: string;
}

const COLOUR_TERMS: Record<BoardColour, string> = {
  bw: "black and grey",
  colour: "colour",
  either: "",
};

const MAX_QUERY_CHARS = 200;

export function buildInspirationQuery(brief: InspirationBrief): string {
  const parts: string[] = [];
  const desc = brief.description.trim().replace(/\s+/g, " ").toLowerCase();
  if (desc) parts.push(desc.slice(0, 120));
  for (const s of brief.styles) {
    const term = s
      .trim()
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ");
    if (term) parts.push(term);
  }
  if (brief.colour && COLOUR_TERMS[brief.colour])
    parts.push(COLOUR_TERMS[brief.colour]);
  let q = parts.join(" ");
  if (!/\btattoos?\b/.test(q)) q = `${q} tattoo`.trim();
  return q.slice(0, MAX_QUERY_CHARS).trim();
}

export interface WebImageResult {
  url: string;
  thumbUrl: string | null;
  sourceUrl: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
}

export interface ImageSearchPage {
  results: WebImageResult[];
  nextStart: number | null;
}

export interface ImageSearchProvider {
  name: string;
  search(query: string, start: number): Promise<ImageSearchPage>;
}

interface CseItem {
  title?: string;
  link?: string;
  image?: {
    thumbnailLink?: string;
    contextLink?: string;
    width?: number;
    height?: number;
  };
}
interface CseResponse {
  items?: CseItem[];
  queries?: { nextPage?: { startIndex?: number }[] };
}

/** Google Programmable Search (Custom Search JSON API) image search. */
export function googleCseProvider(opts: {
  key: string;
  cx: string;
  fetchImpl?: typeof fetch;
}): ImageSearchProvider {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name: "google-cse",
    async search(query, start) {
      const u = new URL("https://www.googleapis.com/customsearch/v1");
      u.searchParams.set("key", opts.key);
      u.searchParams.set("cx", opts.cx);
      u.searchParams.set("q", query);
      u.searchParams.set("searchType", "image");
      u.searchParams.set("safe", "active");
      u.searchParams.set("num", "10");
      u.searchParams.set("start", String(start));
      const res = await fetchImpl(u.toString(), {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Image search provider responded ${res.status}`);
      }
      const body = (await res.json()) as CseResponse;
      const results: WebImageResult[] = (body.items ?? [])
        .filter(
          (i): i is CseItem & { link: string } => typeof i.link === "string",
        )
        .map((i) => ({
          url: i.link,
          thumbUrl: i.image?.thumbnailLink ?? null,
          sourceUrl: i.image?.contextLink ?? null,
          title: i.title ?? null,
          width: i.image?.width ?? null,
          height: i.image?.height ?? null,
        }));
      const next = body.queries?.nextPage?.[0]?.startIndex;
      // The API serves at most 100 results (start ≤ 91).
      const nextStart = typeof next === "number" && next <= 91 ? next : null;
      return { results, nextStart };
    },
  };
}

interface BraveImageResult {
  title?: string;
  /** Page the image was found on. */
  url?: string;
  thumbnail?: { src?: string };
  properties?: { url?: string };
}
interface BraveImageResponse {
  results?: BraveImageResult[];
}

/** Results requested per Brave call; the endpoint has no offset paging. */
const BRAVE_COUNT = 40;

/**
 * Brave Search image API. Web-wide image search with strict SafeSearch;
 * returns one page of up to BRAVE_COUNT results (no offset pagination, so
 * `nextStart` is always null).
 */
export function braveImageProvider(opts: {
  key: string;
  fetchImpl?: typeof fetch;
}): ImageSearchProvider {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name: "brave-images",
    async search(query) {
      const u = new URL("https://api.search.brave.com/res/v1/images/search");
      u.searchParams.set("q", query);
      u.searchParams.set("safesearch", "strict");
      u.searchParams.set("count", String(BRAVE_COUNT));
      u.searchParams.set("spellcheck", "1");
      const res = await fetchImpl(u.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": opts.key,
        },
      });
      if (!res.ok) {
        throw new Error(`Image search provider responded ${res.status}`);
      }
      const body = (await res.json()) as BraveImageResponse;
      const results: WebImageResult[] = (body.results ?? [])
        .filter(
          (r): r is BraveImageResult & { properties: { url: string } } =>
            typeof r.properties?.url === "string",
        )
        .map((r) => ({
          url: r.properties.url,
          thumbUrl: r.thumbnail?.src ?? null,
          sourceUrl: r.url ?? null,
          title: r.title ?? null,
          width: null,
          height: null,
        }));
      return { results, nextStart: null };
    },
  };
}

/**
 * Pick the configured provider: Brave when `BRAVE_SEARCH_KEY` is set,
 * otherwise Google when both CSE values are set (legacy — Google no longer
 * grants new projects access to the Custom Search JSON API), else null.
 */
export function providerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ImageSearchProvider | null {
  const brave = env.BRAVE_SEARCH_KEY?.trim();
  if (brave) return braveImageProvider({ key: brave });
  const key = env.GOOGLE_CSE_KEY?.trim();
  const cx = env.GOOGLE_CSE_CX?.trim();
  if (!key || !cx) return null;
  return googleCseProvider({ key, cx });
}

export interface StudioImageResult {
  galleryItemId: string;
  url: string;
  title: string;
  style: string | null;
  artistName: string | null;
  sourceUrl: string;
}

/** Words from the description worth matching against gallery titles. */
function keywords(description: string): string[] {
  return description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
}

export async function findStudioMatches(
  brief: InspirationBrief,
  take = 12,
): Promise<StudioImageResult[]> {
  const rows = await prisma.galleryItem.findMany({
    where: {
      image: { not: null },
      ...(brief.styles.length ? { style: { in: brief.styles } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    take: 60,
    select: {
      id: true,
      title: true,
      style: true,
      image: true,
      artist: { select: { name: true } },
    },
  });
  const words = keywords(brief.description);
  const scored = rows.map((r, i) => ({
    r,
    i,
    hit: words.some((w) => r.title.toLowerCase().includes(w)) ? 1 : 0,
  }));
  scored.sort((a, b) => b.hit - a.hit || a.i - b.i);
  return scored.slice(0, take).map(({ r }) => ({
    galleryItemId: r.id,
    url: r.image as string,
    title: r.title,
    style: r.style,
    artistName: r.artist?.name ?? null,
    sourceUrl: "/gallery",
  }));
}

export interface InspirationResponse {
  query: string;
  studio: StudioImageResult[];
  web: WebImageResult[];
  nextStart: number | null;
  providerConfigured: boolean;
  webError: boolean;
}

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; page: ImageSearchPage }>();

export function clearInspirationCache(): void {
  cache.clear();
}

function cacheGet(key: string, now: number): ImageSearchPage | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.page;
}

function cacheSet(key: string, page: ImageSearchPage, now: number): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: now, page });
}

export async function searchInspiration(
  input: InspirationBrief & { start?: number },
  deps: {
    provider?: ImageSearchProvider | null;
    findStudio?: typeof findStudioMatches;
    now?: () => number;
  } = {},
): Promise<InspirationResponse> {
  const provider =
    deps.provider === undefined ? providerFromEnv() : deps.provider;
  const findStudio = deps.findStudio ?? findStudioMatches;
  const now = deps.now ?? Date.now;
  const start = input.start ?? 1;
  const query = buildInspirationQuery(input);

  const studioPromise = start === 1 ? findStudio(input) : Promise.resolve([]);

  let web: WebImageResult[] = [];
  let nextStart: number | null = null;
  let webError = false;
  if (provider) {
    const key = `${provider.name}|${query}|${start}`;
    const cached = cacheGet(key, now());
    if (cached) {
      web = cached.results;
      nextStart = cached.nextStart;
    } else {
      try {
        const page = await provider.search(query, start);
        cacheSet(key, page, now());
        web = page.results;
        nextStart = page.nextStart;
      } catch (err) {
        webError = true;
        console.error(
          "[inkling] image search failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  const studio = await studioPromise;
  return {
    query,
    studio,
    web,
    nextStart,
    providerConfigured: Boolean(provider),
    webError,
  };
}
