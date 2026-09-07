import { getMoodboardAsset } from "@bnb/core/services/moodboard-assets";
import { handleApiError, jsonError } from "@bnb/core/http";

/**
 * GET /api/inkling/assets/[id] — serves a stored mood-board upload. Public by
 * unguessable cuid (the admin origin renders these in the inbox). Immutable:
 * an asset's bytes never change.
 */

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const asset = await getMoodboardAsset(id);
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
