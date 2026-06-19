import { cn } from "@/lib/utils";

/**
 * Filter / selection chip. `on` highlights it (crimson, or gold with the
 * `gold` variant). Renders as a button so it is keyboard-operable.
 */
export function Chip({
  children,
  on = false,
  gold = false,
  onClick,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  on?: boolean;
  gold?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={cn("chip", gold && "gold", on && "on", className)}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
