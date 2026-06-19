import { Star } from "lucide-react";

/**
 * Five-star rating display. `value` (0–5, decimals ok) lights N full stars
 * and optionally prints the numeric value.
 */
export function Stars({
  value,
  showValue = true,
}: {
  value: number;
  showValue?: boolean;
}) {
  const rounded = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`star${i < rounded ? " on" : ""}`}
          fill={i < rounded ? "currentColor" : "none"}
        />
      ))}
      {showValue && <b>{value.toFixed(1)}</b>}
    </span>
  );
}
