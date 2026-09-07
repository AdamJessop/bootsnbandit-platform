/**
 * Pure logic for the Inkling mood-board builder (Brief → Inspiration →
 * Details → Send). Framework-free so it unit-tests in node; the React steps
 * are thin shells over these helpers.
 */
import {
  MAX_BOARD_ITEMS,
  type BoardColour,
  type MoodboardDataInput,
  type MoodboardItem,
} from "@bnb/core/services/moodboard-data";
import type { StudioImageResult, WebImageResult } from "@bnb/core/services/image-search";
import { type SizeChoice } from "../../enquire/logic";

export { MAX_BOARD_ITEMS };
export { MAX_STYLES as MAX_BOARD_STYLES, PLACEMENTS, SIZES, toggleStyle } from "../../enquire/logic";

export const BOARD_STEPS = ["Brief", "Inspiration", "Details", "Send"] as const;
export type BoardStep = (typeof BOARD_STEPS)[number];

export const COLOUR_OPTIONS: { value: BoardColour; label: string }[] = [
  { value: "bw", label: "Black & grey" },
  { value: "colour", label: "Colour" },
  { value: "either", label: "Open to either" },
];

export interface BoardItem extends MoodboardItem {
  /** Stable client key: url for web/link, `studio:<id>`, `asset:<id>`. */
  key: string;
}

export interface BuilderState {
  styles: string[];
  colour: BoardColour | null;
  description: string;
  /** Last query the server ran (echoed back for the record). */
  query: string | null;
  items: BoardItem[];
  placement: string;
  size: SizeChoice | "";
  budget: string;
  artistId: string | null;
  notes: string;
  name: string;
  email: string;
  phone: string;
}

/** Shared updater type for the builder's `set`: a plain patch, or a function
 * of the current state (so callers can merge against the latest state rather
 * than a stale closure — important when multiple async operations, e.g.
 * concurrent uploads, race to update `items`). */
export type Set = (patch: Partial<BuilderState> | ((s: BuilderState) => Partial<BuilderState>)) => void;

export function emptyBuilder(): BuilderState {
  return {
    styles: [], colour: null, description: "", query: null, items: [],
    placement: "", size: "", budget: "", artistId: null, notes: "",
    name: "", email: "", phone: "",
  };
}

export function briefReady(s: BuilderState): boolean {
  return s.styles.length > 0 || s.description.trim().length >= 3;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canAdvance(step: BoardStep, s: BuilderState): boolean {
  switch (step) {
    case "Brief":
      return briefReady(s);
    case "Inspiration":
      return s.items.length > 0;
    case "Details":
      return true;
    case "Send": {
      const email = s.email.trim();
      const phone = s.phone.replace(/\s+/g, "");
      if (!s.name.trim()) return false;
      if (email) return EMAIL_RE.test(email);
      return phone.length >= 6;
    }
    default:
      return false;
  }
}

const blank = (): Omit<MoodboardItem, "kind" | "url"> => ({
  thumbUrl: null, sourceUrl: null, title: null, assetId: null, galleryItemId: null,
});

export function webResultToItem(r: WebImageResult): BoardItem {
  return { ...blank(), kind: "web", key: r.url, url: r.url, thumbUrl: r.thumbUrl, sourceUrl: r.sourceUrl, title: r.title };
}

export function studioResultToItem(r: StudioImageResult): BoardItem {
  return {
    ...blank(), kind: "studio", key: `studio:${r.galleryItemId}`, url: r.url, sourceUrl: r.sourceUrl,
    title: r.artistName ? `${r.title} · ${r.artistName}` : r.title, galleryItemId: r.galleryItemId,
  };
}

export function uploadToItem(u: { assetId: string; url: string }, title: string | null = null): BoardItem {
  return { ...blank(), kind: "upload", key: `asset:${u.assetId}`, url: u.url, assetId: u.assetId, title };
}

export function parsePastedUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function linkToItem(url: string): BoardItem {
  return { ...blank(), kind: "link", key: url, url };
}

export function hasItem(items: BoardItem[], key: string): boolean {
  return items.some((i) => i.key === key);
}

export type ToggleResult =
  | { ok: true; items: BoardItem[]; added: boolean }
  | { ok: false; error: string };

export function toggleItem(items: BoardItem[], item: BoardItem): ToggleResult {
  if (hasItem(items, item.key)) {
    return { ok: true, items: items.filter((i) => i.key !== item.key), added: false };
  }
  if (items.length >= MAX_BOARD_ITEMS) {
    return { ok: false, error: `Your board is full — up to ${MAX_BOARD_ITEMS} images. Remove one to add another.` };
  }
  return { ok: true, items: [...items, item], added: true };
}

export function removeItem(items: BoardItem[], key: string): BoardItem[] {
  return items.filter((i) => i.key !== key);
}

export function buildSearchRequest(s: BuilderState, start = 1) {
  return { styles: s.styles, colour: s.colour, description: s.description.trim(), start };
}

export type SearchStatus = "idle" | "loading" | "done" | "error";

/**
 * Should `useImageSearch` run a fresh search? Re-mounting the Inspiration
 * step (e.g. after visiting Details and coming back) must reuse whatever the
 * hook already has rather than re-searching and dropping any "Load more"
 * pages — but a genuinely new brief, or retrying after an error, should run.
 * "Search again" bypasses this and always runs.
 */
export function shouldRunSearch(lastKey: string | null, nextKey: string, status: SearchStatus): boolean {
  if (lastKey !== nextKey) return true;
  return status !== "done" && status !== "loading";
}

export function budgetToPence(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export interface BoardEnquiryPayload {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredArtistId: string | null;
  style: string | null;
  placement: string | null;
  size: string | null;
  budgetPence: number | null;
  description: string | null;
  moodboard: string[];
  moodboardData: MoodboardDataInput;
  source: "inkling";
}

export function buildBoardEnquiryPayload(s: BuilderState): BoardEnquiryPayload {
  const description = s.description.trim();
  const notes = s.notes.trim();
  const items = s.items.map(({ key: _key, ...item }) => item);
  return {
    contactName: s.name.trim(),
    contactEmail: s.email.trim() || null,
    contactPhone: s.phone.trim() || null,
    preferredArtistId: s.artistId,
    style: s.styles.length ? s.styles.join(", ") : null,
    placement: s.placement || null,
    size: s.size || null,
    budgetPence: budgetToPence(s.budget),
    description: [description, notes].filter(Boolean).join("\n\n") || null,
    moodboard: items.map((i) => i.url),
    moodboardData: {
      version: 1, styles: s.styles, colour: s.colour, description, query: s.query, notes: notes || null, items,
    },
    source: "inkling",
  };
}
