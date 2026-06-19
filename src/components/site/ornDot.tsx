/**
 * 4-point star "dot" used inside eyebrow labels. Returns an inline SVG glyph
 * sized to the surrounding text (gold via currentColor on .eyebrow).
 */
export function ornDot() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M6 0 7 5 12 6 7 7 6 12 5 7 0 6 5 5Z" />
    </svg>
  );
}
