/**
 * Lightweight prop shapes shared by the ported site primitives. These mirror
 * the prototype's seed data; the real domain types (Prisma models) are wired
 * into these components in Wave 4. Kept intentionally minimal/optional so the
 * primitives can render from sample props today.
 */
import type { BooksStatus } from "./books";

export interface Artist {
  id: string;
  name: string;
  /** First name convenience for CTAs ("Enquire with {first}"). */
  first?: string;
  role?: string;
  tag?: string;
  books: BooksStatus;
  rating?: number;
  pieces?: number;
  styles?: string[];
  avatar?: string;
  photo?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  style?: string;
  placement?: string;
  artistName?: string;
  src?: string;
  /** Render as a 2x2 feature tile in the masonry. */
  big?: boolean;
}
