import { cn } from "@/lib/utils";

export type TagTone = "crimson" | "gold" | "teal";

/** Small inline taxonomy tag (specialism / style / rate). */
export function Tag({
  children,
  tone = "crimson",
  className,
}: {
  children: React.ReactNode;
  tone?: TagTone;
  className?: string;
}) {
  return (
    <span className={cn("tag", `tag-${tone}`, className)}>{children}</span>
  );
}
