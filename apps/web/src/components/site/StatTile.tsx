import { cn } from "@bnb/core/utils";

export type StatTone = "crimson" | "gold" | "teal" | "default";

/** Single big-number stat cell used in the home `.stat-strip`. */
export function StatTile({
  num,
  label,
  tone = "default",
}: {
  num: string;
  label: string;
  tone?: StatTone;
}) {
  return (
    <div className="stat-tile">
      <div className={cn("stat-num", tone !== "default" && tone)}>{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
