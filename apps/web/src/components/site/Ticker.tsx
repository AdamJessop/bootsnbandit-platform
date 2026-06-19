import { TICKER_LINES } from "@/lib/site-nav";

/**
 * Crimson marquee strip above the nav. Lines duplicated so the CSS
 * translateX(-50%) loop reads seamlessly.
 */
export function Ticker({ lines = TICKER_LINES }: { lines?: string[] }) {
  const run = (
    <span>
      {lines.map((l, i) => (
        <span key={i}>
          {l}
          <i>✦</i>
        </span>
      ))}
    </span>
  );
  return (
    <div className="ticker" aria-hidden>
      <div className="track">
        {run}
        {run}
      </div>
    </div>
  );
}
