import { z } from "zod";

/**
 * The rich Inkling mood board stored in `Enquiry.moodboardData`. Client-safe
 * (zod only — imported by admin client components and the web builder), so
 * NO prisma imports here.
 */

export const BOARD_ITEM_KINDS = ["web", "studio", "upload", "link"] as const;
export type BoardItemKind = (typeof BOARD_ITEM_KINDS)[number];

export const BOARD_COLOURS = ["bw", "colour", "either"] as const;
export type BoardColour = (typeof BOARD_COLOURS)[number];

export const MAX_BOARD_ITEMS = 12;

const url = z.string().max(2048);

export const moodboardItemSchema = z.object({
  kind: z.enum(BOARD_ITEM_KINDS),
  url,
  thumbUrl: url.nullable().default(null),
  sourceUrl: url.nullable().default(null),
  title: z.string().max(200).nullable().default(null),
  assetId: z.string().max(64).nullable().default(null),
  galleryItemId: z.string().max(64).nullable().default(null),
});

export const moodboardDataSchema = z.object({
  version: z.literal(1),
  styles: z.array(z.string().max(60)).max(5).default([]),
  colour: z.enum(BOARD_COLOURS).nullable().default(null),
  description: z.string().max(1000).default(""),
  query: z.string().max(300).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  items: z.array(moodboardItemSchema).max(MAX_BOARD_ITEMS),
});

export type MoodboardItem = z.output<typeof moodboardItemSchema>;
export type MoodboardData = z.output<typeof moodboardDataSchema>;
export type MoodboardDataInput = z.input<typeof moodboardDataSchema>;

/** Tolerant parse for DB rows: null / old rows / garbage → null, never throws. */
export function parseMoodboardData(json: unknown): MoodboardData | null {
  const r = moodboardDataSchema.safeParse(json);
  return r.success ? r.data : null;
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function assetUrl(origin: string, assetId: string): string {
  return `${trimOrigin(origin)}/api/inkling/assets/${assetId}`;
}

function absolutise(u: string | null, origin: string): string | null {
  if (!u) return u;
  return u.startsWith("/") ? `${trimOrigin(origin)}${u}` : u;
}

/**
 * Server-side normalisation before persisting: upload items get their public
 * asset URL, relative (studio) URLs become absolute so the admin origin can
 * render them, uploads without an asset are dropped. Returns the display URL
 * list for `Enquiry.moodboard[]` and the asset ids to attach.
 */
export function finaliseMoodboardData(
  data: MoodboardData,
  origin: string,
): { data: MoodboardData; urls: string[]; assetIds: string[] } {
  const items: MoodboardItem[] = [];
  const assetIds: string[] = [];
  for (const item of data.items) {
    if (item.kind === "upload") {
      if (!item.assetId) continue;
      if (!assetIds.includes(item.assetId)) assetIds.push(item.assetId);
      items.push({
        ...item,
        url: assetUrl(origin, item.assetId),
        thumbUrl: null,
      });
      continue;
    }
    items.push({
      ...item,
      url: absolutise(item.url, origin) as string,
      thumbUrl: absolutise(item.thumbUrl, origin),
      sourceUrl: absolutise(item.sourceUrl, origin),
    });
  }
  return { data: { ...data, items }, urls: items.map((i) => i.url), assetIds };
}
