"use client";

import { useState } from "react";
import { ArrowLeft, AtSign, Star } from "lucide-react";
import { artistStatusLabel, type ArtistStatus } from "@bnb/core/artist-status";
import { ArtistAvatar } from "./ArtistAvatar";
import type {
  ArtistShowcase,
  BoardArtist,
  ShowcaseGalleryItem,
} from "./kiosk-logic";

/** "Title · style · placement" caption, dropping any null parts. */
function galleryCaption(g: ShowcaseGalleryItem): string {
  return [g.title, g.style, g.placement].filter(Boolean).join(" · ");
}

/**
 * Full-screen enlarged view of one gallery piece. Tapping anywhere closes
 * it. Pure and standalone so it can be unit-tested independently of the
 * screen's open/closed state.
 */
export function ShowcaseLightbox({
  item,
  onClose,
}: {
  item: ShowcaseGalleryItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <div className="rk-lightbox" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="rk-lightbox-img" src={item.image} alt={item.title} />
      <div className="rk-lightbox-cap">{galleryCaption(item)}</div>
    </div>
  );
}

/**
 * Artist showcase overlay — a full-screen "show the walk-in the artist's
 * work" screen for the reception kiosk. `artist` (board data) renders the
 * header instantly; the richer `showcase` payload streams in separately, so
 * there is no internal fetching here, only a loading hint while it is null.
 */
export function ArtistShowcaseScreen({
  artist,
  showcase,
  onExit,
}: {
  artist: BoardArtist;
  showcase: ArtistShowcase | null;
  onExit: () => void;
}) {
  const [lightbox, setLightbox] = useState<ShowcaseGalleryItem | null>(null);
  const statusLabel = artistStatusLabel(artist.status as ArtistStatus);

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onExit}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">{artist.name}</div>
          <div className="rk-screen-sub">
            {statusLabel}
            {artist.tag ? ` · ${artist.tag}` : ""}
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        {showcase === null ? (
          <p className="rk-showcase-loading">Loading portfolio…</p>
        ) : (
          <div className="rk-showcase">
            <div className="rk-showcase-hero">
              <ArtistAvatar artist={showcase.artist} size={96} />
              <div className="rk-showcase-hero-main">
                <div className="rk-showcase-name">{showcase.artist.name}</div>
                <div className="rk-showcase-kicker">
                  {statusLabel}
                  {showcase.artist.experience
                    ? ` · ${showcase.artist.experience} experience`
                    : ""}
                </div>
                {showcase.artist.tag ? (
                  <div className="rk-showcase-lead">{showcase.artist.tag}</div>
                ) : null}
                {showcase.artist.bio ? (
                  <p className="rk-showcase-bio">{showcase.artist.bio}</p>
                ) : null}
                <div className="rk-showcase-meta">
                  {showcase.artist.rating != null ? (
                    <span className="rk-showcase-meta-item">
                      <Star className="ic" />
                      {showcase.artist.rating}
                    </span>
                  ) : null}
                  {showcase.artist.pieces != null ? (
                    <span className="rk-showcase-meta-item">
                      {showcase.artist.pieces} pieces
                    </span>
                  ) : null}
                  {showcase.artist.insta ? (
                    <span className="rk-showcase-meta-item">
                      <AtSign className="ic" />
                      {showcase.artist.insta}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {showcase.artist.styles.length > 0 ? (
              <div className="rk-showcase-tags">
                <div className="rk-showcase-tags-label">Styles</div>
                <div className="rk-showcase-tag-row">
                  {showcase.artist.styles.map((s) => (
                    <span key={s} className="rk-showcase-tag">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {showcase.artist.specials.length > 0 ? (
              <div className="rk-showcase-tags">
                <div className="rk-showcase-tags-label">Specialisms</div>
                <div className="rk-showcase-tag-row">
                  {showcase.artist.specials.map((s) => (
                    <span key={s} className="rk-showcase-tag">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rk-showcase-gallery-label">Portfolio</div>
            {showcase.gallery.length === 0 ? (
              <p className="rk-showcase-empty">Portfolio photos coming soon.</p>
            ) : (
              <div className="rk-showcase-gallery">
                {showcase.gallery.map((g) => (
                  <button
                    key={g.id}
                    className={
                      "rk-showcase-tile" + (g.featured ? " featured" : "")
                    }
                    onClick={() => setLightbox(g)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.image} alt={g.title} />
                    <span className="rk-showcase-tile-cap">
                      {galleryCaption(g)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <ShowcaseLightbox item={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
