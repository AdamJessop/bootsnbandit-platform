import type { BoardArtist } from "./kiosk-logic";

/** Brand hue → avatar disc tint (matches the seeded Artist.hue values). */
const HUE_BG: Record<string, string> = {
  crimson: "linear-gradient(135deg,#9c1f38,#c92f4d)",
  gold: "linear-gradient(135deg,#8a6a3b,#cfa05a)",
  teal: "linear-gradient(135deg,#1f807a,#36b0a8)",
  rust: "linear-gradient(135deg,#7d3f1c,#b0622f)",
  plum: "linear-gradient(135deg,#4e2a52,#7d4585)",
  steel: "linear-gradient(135deg,#3a4652,#5d7285)",
  ink: "linear-gradient(135deg,#26221c,#4a4238)",
};

export function artistInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Round artist avatar — headshot when set, else initials on the artist's
 * brand-hue disc.
 */
export function ArtistAvatar({
  artist,
  size = 44,
}: {
  artist: Pick<BoardArtist, "name" | "headshot" | "hue">;
  size?: number;
}) {
  const bg = HUE_BG[artist.hue ?? ""] ?? HUE_BG.ink;
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: bg }}
      title={artist.name}
    >
      {artist.headshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar-img" src={artist.headshot} alt={artist.name} />
      ) : (
        <span className="avatar-i" style={{ fontSize: size * 0.38 }}>
          {artistInitials(artist.name)}
        </span>
      )}
    </span>
  );
}
