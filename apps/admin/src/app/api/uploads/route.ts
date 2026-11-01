import { requireRole } from "@bnb/core/auth";
import { handleApiError, json, jsonError } from "@bnb/core/http";
import { createMediaAsset, mediaUrl } from "@bnb/core/services/media-assets";
import { IMAGE_EXT_BY_MIME, sniffImageMime } from "@bnb/core/uploads";

/**
 * POST /api/uploads — owner-gated image upload for the content CMS
 * (gallery / flash / artist headshots). Bytes are sniffed (raster only, never
 * SVG) and stored in Postgres, not on disk: web + admin are separate
 * containers with ephemeral disks, and Next only serves `public/` files that
 * existed at build time. The response URL (`/media/[id]`) is served by BOTH
 * apps, so the same value renders in the CMS preview and on the public site.
 */

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole("OWNER");

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return jsonError(400, "No file provided");
    }
    if (file.size === 0) {
      return jsonError(400, "Empty file");
    }
    if (file.size > MAX_BYTES) {
      return jsonError(413, "File too large (max 8MB)");
    }

    // Reject obviously-unsupported client types early (cheap), but never trust
    // them: the authoritative check is the magic-number sniff below.
    if (!IMAGE_EXT_BY_MIME[file.type]) {
      return jsonError(
        415,
        `Unsupported image type: ${file.type || "unknown"}`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Validate the actual file bytes. This blocks stored XSS via SVG/HTML
    // payloads and content-type spoofing (e.g. an SVG sent as image/png).
    const sniffed = sniffImageMime(bytes);
    if (!sniffed || sniffed !== file.type) {
      return jsonError(
        415,
        "File content does not match a supported image format",
      );
    }

    const asset = await createMediaAsset({ bytes, mime: sniffed });
    return json({ url: mediaUrl(asset.id) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
