"use client";

import { Eye } from "lucide-react";
import { cn } from "@bnb/core/utils";
import { Plate } from "./Plate";
import type { GalleryItem } from "./types";

/**
 * Masonry gallery tile. Renders a seeded plate with a hover overlay
 * (artist + "View piece"). `onOpen` fires the lightbox in Wave 4; falls back
 * to a no-op so the tile renders standalone with sample data today.
 */
export function GalleryTile({
  item,
  onOpen,
}: {
  item: GalleryItem;
  onOpen?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn("gtile", item.big && "big")}
      onClick={() => onOpen?.(item.id)}
      aria-label={item.title}
    >
      <Plate
        seed={`gallery-${item.id}`}
        src={item.src}
        className="gtile-plate"
        cap={[item.title, item.style]}
      />
      <span className="gtile-hover">
        <span className="gtile-art">{item.artistName ?? item.title}</span>
        <span className="gtile-view">
          <Eye className="ic" /> View piece
        </span>
      </span>
    </button>
  );
}
