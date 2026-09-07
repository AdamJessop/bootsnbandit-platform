/**
 * Client-side downscale before upload so boards stay small in Postgres:
 * long edge ≤ 1600px, JPEG q0.85. Pure sizing maths is exported for tests;
 * `prepareImage` needs a browser (createImageBitmap + canvas).
 */
export const MAX_EDGE = 1600;
export const SKIP_BELOW_BYTES = 600_000;

export function targetDimensions(w: number, h: number, maxEdge = MAX_EDGE) {
  const long = Math.max(w, h);
  if (long <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / long;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function shouldDownscale(sizeBytes: number, w: number, h: number, maxEdge = MAX_EDGE): boolean {
  return sizeBytes > SKIP_BELOW_BYTES && Math.max(w, h) > maxEdge;
}

export async function prepareImage(file: File): Promise<File> {
  if (file.size <= SKIP_BELOW_BYTES || file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  if (!shouldDownscale(file.size, bitmap.width, bitmap.height)) {
    bitmap.close();
    return file;
  }
  const { width, height } = targetDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
