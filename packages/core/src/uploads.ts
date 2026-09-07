/**
 * Shared image-upload validation for the admin CMS uploader and the public
 * Inkling mood-board uploader. Raster formats only — SVG is XML and can carry
 * scripts, so it is never accepted. The authoritative check is the
 * magic-number sniff; client-supplied `file.type` is only a cheap pre-filter.
 */

export const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function isAllowedImageMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(IMAGE_EXT_BY_MIME, mime);
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < buf.length; i++)
    s += String.fromCharCode(buf[i]);
  return s;
}

/** Sniff the real image format from leading bytes; null when not an allowed raster. */
export function sniffImageMime(buf: Uint8Array): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (buf.length >= 6 && ascii(buf, 0, 3) === "GIF") return "image/gif";
  if (
    buf.length >= 12 &&
    ascii(buf, 0, 4) === "RIFF" &&
    ascii(buf, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buf.length >= 12 &&
    ascii(buf, 4, 8) === "ftyp" &&
    /avif|avis/.test(ascii(buf, 8, 12))
  ) {
    return "image/avif";
  }
  return null;
}
