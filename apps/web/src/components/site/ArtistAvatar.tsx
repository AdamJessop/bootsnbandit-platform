import { plateBg } from "./plate";

export interface ArtistLike {
  name: string;
  /** Optional headshot URL; falls back to initials on a seeded tint. */
  avatar?: string;
}

const SIZES = { sm: 32, md: 44, lg: 64 } as const;

/**
 * Round artist avatar — photo if available, else initials on a deterministic
 * brand-tinted disc seeded from the name.
 */
export function ArtistAvatar({
  artist,
  size = "md",
}: {
  artist: ArtistLike;
  size?: keyof typeof SIZES;
}) {
  const px = SIZES[size];
  const initials = artist.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = plateBg(artist.name).background;
  return (
    <span
      className="avatar"
      style={{ width: px, height: px, background: bg }}
      title={artist.name}
    >
      {artist.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="avatar-img"
          src={artist.avatar}
          alt={artist.name}
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="avatar-i" style={{ fontSize: px * 0.4 }}>
          {initials}
        </span>
      )}
    </span>
  );
}
