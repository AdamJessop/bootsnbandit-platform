import { requireRole } from "@bnb/core/auth";
import { getAttachment } from "@bnb/core/services/assets";
import { handleApiError, jsonError } from "@bnb/core/http";
import { prisma } from "@bnb/core/db";
import { canAccessEnquiry } from "@/app/(staff)/enquiries/enquiry-helpers";

/**
 * GET /api/attachments/[id] — serves an inbox attachment's stored bytes to
 * signed-in staff (requireRole redirects anonymous callers to /sign-in). Only
 * inline attachments are served: a link-only row (non-image or oversize) is
 * rendered by the thread as an external link, and this route deliberately
 * does NOT redirect to that URL — a staff-gated open redirect is not worth it.
 *
 * Signing in is not enough on its own: an attachment belongs to an enquiry,
 * and an artist must only be able to fetch attachments on enquiries they can
 * access (`canAccessEnquiry`). A caller who fails that check gets a 404, not
 * a 403, so ids can't be probed to learn which ones exist.
 */

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireRole();
    const { id } = await ctx.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      select: {
        message: {
          select: {
            enquiry: { select: { preferredArtistId: true, source: true } },
          },
        },
      },
    });
    const enquiry = attachment?.message?.enquiry;
    if (!enquiry || !canAccessEnquiry(user, enquiry)) {
      return jsonError(404, "Not found");
    }

    const asset = await getAttachment(id);
    if (!asset || !asset.bytes) return jsonError(404, "Not found");
    const filename = (asset.filename ?? `attachment-${asset.id}`).replace(
      /["\\\r\n]/g,
      "",
    );
    return new Response(Uint8Array.from(asset.bytes), {
      status: 200,
      headers: {
        "content-type": asset.mime,
        "content-length": String(asset.size),
        "content-disposition": `inline; filename="${filename}"`,
        // Private: the bytes are only for signed-in staff, never a shared cache.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
