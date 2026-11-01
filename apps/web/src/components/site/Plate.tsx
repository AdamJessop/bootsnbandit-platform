import { cn } from "@bnb/core/utils";
import { Mark } from "./Mark";
import { plateBg } from "./plate";

/**
 * Image placeholder "plate". Renders a deterministic brand-tinted gradient
 * (from `seed`) with a watermark Mark, or a real photo via `src`. Variants:
 * - `face`  → headshot framing (mark anchored bottom)
 * - `photo` → render real <img> at `src`
 * - `paper` → cream paper backdrop (flash designs)
 * `ratio` sets aspect-ratio (e.g. "3/4", "1/1"). `cap` adds a bottom caption.
 * Photos lazy-load and decode off the main thread; the plate box (ratio or the
 * surrounding grid) reserves the space, so nothing shifts as they arrive. Pass
 * `eager` for an above-the-fold hero image.
 */
export interface PlateProps {
  seed?: string;
  hue?: number;
  src?: string;
  ratio?: string;
  face?: boolean;
  photo?: boolean;
  paper?: boolean;
  /** Bottom caption: [left, right] */
  cap?: [string, string?];
  /** Show the "PHOTO"/"HEADSHOT" placeholder label. */
  placeholder?: boolean;
  /** Alt text for the photo; defaults to the caption, then "Tattoo". */
  alt?: string;
  /** Load the photo immediately (above-the-fold hero). */
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Plate({
  seed = "plate",
  hue,
  src,
  ratio,
  face = false,
  photo = false,
  paper = false,
  cap,
  placeholder = false,
  alt,
  eager = false,
  className,
  style,
}: PlateProps) {
  const art = plateBg(seed, hue);
  const showImg = (photo || !!src) && !!src;

  return (
    <div
      className={cn(
        "plate",
        face && "is-face",
        paper && "paper",
        placeholder && "ph",
        className,
      )}
      style={{ aspectRatio: ratio, ...style }}
    >
      {!paper && (
        <>
          <div
            className="plate-art"
            style={{ background: art.background }}
            aria-hidden
          />
          <div className="plate-noise" aria-hidden />
        </>
      )}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="plate-photo"
          src={src}
          alt={alt ?? cap?.[0] ?? "Tattoo"}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <div className="plate-mark" aria-hidden>
          <Mark />
        </div>
      )}
      {cap && (
        <div className="plate-cap">
          <span className="pc-l">{cap[0]}</span>
          {cap[1] && <span className="pc-r">{cap[1]}</span>}
        </div>
      )}
    </div>
  );
}
