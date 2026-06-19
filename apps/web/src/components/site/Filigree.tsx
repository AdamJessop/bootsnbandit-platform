/**
 * Heritage filigree divider — two gradient rules flanking a small diamond.
 * Ornament opacity is driven by the `--ornament` token, so it softens in
 * the noir direction and disappears entirely in grit.
 */
export function Filigree({ className }: { className?: string }) {
  return (
    <div className={`filigree${className ? ` ${className}` : ""}`} aria-hidden>
      <span className="rule" />
      <span className="diamond" />
      <span className="rule r" />
    </div>
  );
}
