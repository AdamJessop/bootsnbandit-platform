"use client";

/**
 * Placement picker — a simplified front-body silhouette with 8 selectable
 * zones (Upper arm / Forearm / Chest / Ribs / Thigh / Calf / Shoulder / Back).
 * `active` is the chosen zone label; `onPick` reports the new selection.
 */
export const BODY_ZONES = [
  "Upper arm",
  "Forearm",
  "Chest",
  "Ribs",
  "Thigh",
  "Calf",
  "Shoulder",
  "Back",
] as const;
export type BodyZone = (typeof BODY_ZONES)[number];

// rough rects over a 100x200 silhouette viewBox — schematic, not anatomical
const ZONE_RECTS: Record<
  BodyZone,
  { x: number; y: number; w: number; h: number }
> = {
  Shoulder: { x: 30, y: 46, w: 40, h: 10 },
  Chest: { x: 36, y: 56, w: 28, h: 18 },
  "Upper arm": { x: 20, y: 56, w: 12, h: 20 },
  Forearm: { x: 16, y: 76, w: 12, h: 22 },
  Ribs: { x: 38, y: 74, w: 24, h: 16 },
  Back: { x: 68, y: 56, w: 12, h: 34 },
  Thigh: { x: 36, y: 118, w: 14, h: 30 },
  Calf: { x: 36, y: 150, w: 12, h: 30 },
};

export function BodyMap({
  active,
  onPick,
}: {
  active?: BodyZone | null;
  onPick: (zone: BodyZone) => void;
}) {
  return (
    <div className="bodymap">
      <svg className="bodymap-svg" viewBox="0 0 100 200" role="group">
        {/* silhouette */}
        <path
          className="body-silhouette"
          d="M50 6a9 9 0 0 1 9 9 9 9 0 0 1-3 6c8 2 14 8 14 18v22l8 26-6 2-6-22v54l4 46-8 1-7-46h-2l-7 46-8-1 4-46V67l-6 22-6-2 8-26V39c0-10 6-16 14-18a9 9 0 0 1-3-6 9 9 0 0 1 9-9Z"
        />
        {BODY_ZONES.map((zone) => {
          const r = ZONE_RECTS[zone];
          return (
            <rect
              key={zone}
              className={`body-zone${active === zone ? " on" : ""}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={3}
              onClick={() => onPick(zone)}
            >
              <title>{zone}</title>
            </rect>
          );
        })}
      </svg>
      <span className="bodymap-hint">
        {active ? active : "Tap a placement"}
      </span>
    </div>
  );
}
