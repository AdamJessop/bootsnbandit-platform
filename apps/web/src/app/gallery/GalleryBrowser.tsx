"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Chip,
  GalleryTile,
  Plate,
  Modal,
  Mark,
  ArtistAvatar,
  type GalleryItem as GalleryItemProp,
} from "@/components/site";
import { enquireHref, filterGallery, stepIndex } from "./logic";

export interface BrowserItem {
  id: string;
  title: string;
  style: string | null;
  placement: string | null;
  artistSlug: string | null;
  artistName: string | null;
  /** Admin-uploaded photo; falls back to the procedural Plate when null. */
  image?: string | null;
  big: boolean;
}

interface Props {
  items: BrowserItem[];
  styles: string[];
  artists: { slug: string; name: string }[];
}

/**
 * Client island: the gallery wall — style + artist filter chips, a live piece
 * count, the masonry grid, and a lightbox (Modal) with prev/next that wraps
 * within the *filtered* set. Filtering + index-stepping live in `./logic`.
 */
export function GalleryBrowser({ items, styles, artists }: Props) {
  const [style, setStyle] = useState("all");
  const [artist, setArtist] = useState("all");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const shown = useMemo(
    () => filterGallery(items, style, artist),
    [items, style, artist],
  );

  const reset = () => {
    setStyle("all");
    setArtist("all");
  };

  const open = openIdx != null ? shown[openIdx] : null;
  const firstName = (n: string | null) => (n ? n.split(" ")[0] : "the artist");

  return (
    <>
      <div className="stack gap-3" style={{ marginBottom: 14 }}>
        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          <Chip on={style === "all"} onClick={() => setStyle("all")}>
            All
          </Chip>
          {styles.map((s) => (
            <Chip key={s} on={style === s} onClick={() => setStyle(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          <Chip gold on={artist === "all"} onClick={() => setArtist("all")}>
            All artists
          </Chip>
          {artists.map((a) => (
            <Chip
              key={a.slug}
              gold
              on={artist === a.slug}
              onClick={() => setArtist(a.slug)}
            >
              {firstName(a.name)}
            </Chip>
          ))}
        </div>
      </div>

      <p className="meta" style={{ marginBottom: 20 }}>
        {shown.length} {shown.length === 1 ? "piece" : "pieces"}
      </p>

      {shown.length > 0 ? (
        <div className="gallery-masonry">
          {shown.map((g, i) => {
            const item: GalleryItemProp = {
              id: g.id,
              title: g.title,
              style: g.style ?? undefined,
              artistName: g.artistName ?? undefined,
              src: g.image ?? undefined,
              big: g.big,
            };
            return (
              <GalleryTile key={g.id} item={item} onOpen={() => setOpenIdx(i)} />
            );
          })}
        </div>
      ) : (
        <div className="center stack gap-4" style={{ padding: "48px 0" }}>
          <span
            style={{
              width: 56,
              opacity: 0.4,
              margin: "0 auto",
              display: "block",
            }}
          >
            <Mark />
          </span>
          <p className="muted">No pieces match those filters.</p>
          <div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={reset}>
              Reset filters
            </button>
          </div>
        </div>
      )}

      <Modal open={open != null} onClose={() => setOpenIdx(null)} wide>
        {open && (
          <div className="grid gap-6" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
            <Plate
              seed={`gallery-${open.id}`}
              src={open.image ?? undefined}
              ratio="4/5"
              cap={[open.title, open.style ?? undefined]}
            />
            <div className="card-pad stack gap-4">
              <span className="eyebrow">{open.style ?? "Custom"}</span>
              <h3 className="display chrome" style={{ fontSize: 30 }}>
                {open.title}
              </h3>
              <div className="row gap-3">
                <ArtistAvatar artist={{ name: open.artistName ?? "Artist" }} size="sm" />
                <span className="muted">{open.artistName}</span>
              </div>
              <div className="stack gap-3">
                {open.placement && (
                  <span className="meta">Placement · {open.placement}</span>
                )}
                {open.style && <span className="meta">Style · {open.style}</span>}
              </div>
              <p className="muted">
                Like this piece? We&rsquo;ll take the spirit of it and make
                something that&rsquo;s yours — we never copy another
                person&rsquo;s tattoo.
              </p>
              <div className="hero-cta" style={{ marginTop: 0, justifyContent: "flex-start" }}>
                <Link href={enquireHref(open)} className="btn btn-sm">
                  Enquire about this style
                </Link>
                {open.artistSlug && (
                  <Link
                    href={`/artists/${open.artistSlug}`}
                    className="btn btn-sm btn-ghost"
                  >
                    View {firstName(open.artistName)}&rsquo;s profile
                  </Link>
                )}
              </div>
              <div className="row gap-3" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Previous piece"
                  onClick={() =>
                    setOpenIdx((i) =>
                      i == null ? 0 : stepIndex(i, -1, shown.length),
                    )
                  }
                >
                  <ChevronLeft className="ic" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Next piece"
                  onClick={() =>
                    setOpenIdx((i) =>
                      i == null ? 0 : stepIndex(i, 1, shown.length),
                    )
                  }
                >
                  <ChevronRight className="ic" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
