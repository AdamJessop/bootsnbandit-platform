import { getMediaAsset } from "@bnb/core/services/media-assets";
import { handleApiError, jsonError } from "@bnb/core/http";

/**
 * GET /media/[id] — serves a stored CMS image. Shared so web (public pages)
 * and admin (CMS previews) mount the identical handler; each app re-exports
 * it from `src/app/media/[id]/route.ts`. Public by unguessable cuid — these
 * are public-site images. Immutable: an asset's bytes never change (a
 * re-upload is a new id). The mime is the one sniffed at upload.
 */
export async function serveMediaAsset(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const asset = await getMediaAsset(id);
    if (!asset) return jsonError(404, "Not found");
    const body = Uint8Array.from(asset.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": asset.mime,
        "content-length": String(asset.size),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
