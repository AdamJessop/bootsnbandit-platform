/**
 * Procedural placeholder art for <Plate>. Ported from the prototype's
 * `hashStr` / `plateBg` helpers so empty image slots render a deterministic,
 * brand-tinted gradient (swapped for real photos when data is wired in Wave 4).
 */

/** Deterministic 32-bit string hash (seed → stable pseudo-random base). */
export function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // force unsigned
  return h >>> 0;
}

export interface PlateBg {
  /** CSS background value for the .plate-art layer. */
  background: string;
  /** Base hue (0–360) derived from the seed (or the explicit hue override). */
  hue: number;
}

/**
 * Build a deterministic two-stop radial gradient from a seed string.
 * Optional `hue` pins the base hue; otherwise it derives from the hash.
 */
export function plateBg(seed: string, hue?: number): PlateBg {
  const h = hashStr(seed);
  const baseHue = hue ?? h % 360;
  const hue2 = (baseHue + 40 + (h % 30)) % 360;
  const sat = 26 + (h % 22); // 26–47%
  const light = 16 + (h % 12); // 16–27%
  const angle = h % 360;
  const c1 = `hsl(${baseHue} ${sat}% ${light}%)`;
  const c2 = `hsl(${hue2} ${sat + 8}% ${Math.max(8, light - 8)}%)`;
  return {
    background: `linear-gradient(${angle}deg, ${c1}, ${c2})`,
    hue: baseHue,
  };
}
