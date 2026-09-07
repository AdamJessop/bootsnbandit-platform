import { createMoodboardAsset } from "@bnb/core/services/moodboard-assets";
import { handleApiError, json, jsonError } from "@bnb/core/http";
import { isAllowedImageMime, sniffImageMime } from "@bnb/core/uploads";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/inkling/uploads — public mood-board image upload. Bytes are
 * sniffed (raster only, never SVG) and stored in Postgres; the response URL
 * is served by GET /api/inkling/assets/[id]. Orphans are purged by cron.
 */

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(req: Request): Promise<Response> {
  try {
    if (!limiter.hit(clientIp(req))) {
      return jsonError(429, "Too many uploads — please try again in a minute.");
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return jsonError(400, "No file provided");
    if (file.size === 0) return jsonError(400, "Empty file");
    if (file.size > MAX_BYTES) return jsonError(413, "Image too large (max 5MB)");
    if (!isAllowedImageMime(file.type)) {
      return jsonError(415, `Unsupported image type: ${file.type || "unknown"}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageMime(bytes);
    if (!sniffed || sniffed !== file.type) {
      return jsonError(415, "File content does not match a supported image format");
    }
    const asset = await createMoodboardAsset({ bytes, mime: sniffed });
    return json({ assetId: asset.id, url: `/api/inkling/assets/${asset.id}` }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
