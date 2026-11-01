import { serveMediaAsset } from "@bnb/core/http/media";

/**
 * GET /media/[id] — CMS images (gallery pieces and headshots) for the artist
 * showcase and board avatars. Bytes live in Postgres; the shared handler in
 * @bnb/core is mounted identically on web and admin. Without this route the
 * kiosk (its own origin) 404'd every uploaded photo.
 */

export const runtime = "nodejs";

export const GET = serveMediaAsset;
