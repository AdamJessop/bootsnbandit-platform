/**
 * Client-side downscale for CMS uploads. A 48MP phone photo is ~8000px and
 * often >8MB — over the `/api/uploads` cap and far bigger than the site ever
 * renders — so anything past ~2400px on its long edge (or >4MB) is redrawn on
 * a canvas at max 2400px and re-encoded as WebP (JPEG where the browser can't
 * encode WebP) before it is POSTed. GIFs are left alone (canvas would flatten
 * an animation to its first frame). The sizing maths is pure + unit tested;
 * `downscaleImage` needs a browser and falls back to the original file.
 */

export const MAX_EDGE = 2400;
export const RESIZE_OVER_BYTES = 4 * 1024 * 1024;
export const WEBP_QUALITY = 0.85;

export interface ImageFacts {
  type: string;
  size: number;
  width: number;
  height: number;
}

/** Whether an image should be redrawn smaller before upload. */
export function needsDownscale(img: ImageFacts): boolean {
  if (img.type === "image/gif") return false;
  return (
    Math.max(img.width, img.height) > MAX_EDGE || img.size > RESIZE_OVER_BYTES
  );
}

/**
 * Target dimensions that fit inside a `maxEdge` square, keeping the aspect
 * ratio. Never upscales; never returns a zero side.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** "IMG_0042.jpg" + image/webp → "IMG_0042.webp". */
export function renamed(name: string, mime: string): string {
  const ext = mime === "image/webp" ? "webp" : "jpg";
  const stem = name.replace(/\.[^./]+$/, "") || "image";
  return `${stem}.${ext}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale `file` if `needsDownscale` says so; otherwise (or if the browser
 * can't decode it) return it untouched so the server's own checks still run.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const facts = {
      type: file.type,
      size: file.size,
      width: bitmap.width,
      height: bitmap.height,
    };
    if (!needsDownscale(facts)) return file;
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    // Browsers that can't encode WebP silently hand back a PNG instead.
    let blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", WEBP_QUALITY);
    }
    if (!blob) return file;
    return new File([blob], renamed(file.name, blob.type), { type: blob.type });
  } finally {
    bitmap.close();
  }
}
