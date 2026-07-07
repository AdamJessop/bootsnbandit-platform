/**
 * Colour key for the all-staff week overlay (BACKOFHOUSE Task 5). One swatch
 * per artist, coloured via the same artistTone() used to tint event blocks so
 * the legend always matches the grid.
 */

import { cn } from "@bnb/core/utils";
import { artistTone } from "./calendar-layout";

export interface CalendarLegendArtist {
  id: string;
  name: string;
  hue: string | null;
}

export function CalendarLegend({
  artists,
}: {
  artists: CalendarLegendArtist[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-default px-3 py-2">
      {artists.map((a, i) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary"
        >
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-sm",
              artistTone(a.hue, i).swatch,
            )}
          />
          {a.name}
        </span>
      ))}
    </div>
  );
}
