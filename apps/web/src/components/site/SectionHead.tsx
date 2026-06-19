import { ornDot } from "./ornDot";

/**
 * Section heading block: optional eyebrow (with 4-point star dot), display
 * title, sub copy, and an optional right-aligned action node.
 */
export function SectionHead({
  eyebrow,
  title,
  sub,
  action,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  center?: boolean;
}) {
  const head = (
    <div className={`sechead${center ? " center" : ""}`}>
      {eyebrow && (
        <span className="eyebrow">
          {ornDot()}
          {eyebrow}
        </span>
      )}
      <h2 className="display chrome">{title}</h2>
      {sub && <p className="lead">{sub}</p>}
    </div>
  );

  if (!action) return head;
  return (
    <div className="sechead-row">
      {head}
      <div>{action}</div>
    </div>
  );
}
