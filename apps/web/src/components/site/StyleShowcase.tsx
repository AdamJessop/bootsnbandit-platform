import Link from "next/link";

/**
 * Home page Inkling teaser art: a tile grid of tattoo styles with example
 * images, the whole grid linking to the Style Matcher. Falls back to the
 * original abstract gradient plate while no styles have images yet. Styles
 * are curated in the admin CMS (`/content/styles`) — a style appears here
 * once it has an example image, ordered by its sort order.
 */
export function StyleShowcase({
  styles,
}: {
  styles: { name: string; image: string }[];
}) {
  if (styles.length === 0) {
    return (
      <div
        style={{ aspectRatio: "1/1", borderRadius: "var(--radius)" }}
        className="plate"
      >
        <div
          className="plate-art"
          aria-hidden
          style={{
            background:
              "radial-gradient(120% 120% at 30% 20%, rgba(201,47,77,.22), transparent 60%)",
          }}
        />
      </div>
    );
  }
  return (
    <Link
      href="/inkling?tab=match"
      className="style-showcase"
      data-cols={styles.length <= 4 ? "2" : "3"}
      aria-label="Explore our tattoo styles with the Style Matcher"
    >
      {styles.slice(0, 9).map((s) => (
        <span key={s.name} className="style-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image}
            alt={`${s.name} tattoo example`}
            loading="lazy"
            decoding="async"
          />
          <span className="style-tile-name">{s.name}</span>
        </span>
      ))}
    </Link>
  );
}
