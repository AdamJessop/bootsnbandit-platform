import { cn } from "@bnb/core/utils";

/**
 * Boots 'n' Bandit brand mark — an 8-point heritage star.
 * Inline SVG so it inherits currentColor (crimson on the warm-black nav,
 * gold on plates, etc.). Used as the logo glyph and the plate watermark.
 */
export function Mark({
  className,
  title = "Boots 'n' Bandit",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn(className)}
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      <title>{title}</title>
      {/* 8-point star: long cardinals + short diagonals */}
      <path d="M50 2 56 38 66 16 60 40 84 22 62 46 98 50 62 54 84 78 60 60 66 84 56 62 50 98 44 62 34 84 40 60 16 78 38 54 2 50 38 46 16 22 40 40 34 16 44 38Z" />
      <circle cx="50" cy="50" r="7" fill="var(--bg-default, #0d0c0a)" />
      <circle cx="50" cy="50" r="4" fill="currentColor" />
    </svg>
  );
}
