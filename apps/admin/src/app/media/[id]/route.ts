import { serveMediaAsset } from "@bnb/core/http/media";

/**
 * GET /media/[id] — CMS images for the admin previews (ImageUploader, content
 * lists, profiles). Same shared handler as the web app, so an uploaded URL
 * renders on both origins. Public (listed in the middleware's
 * PUBLIC_PREFIXES): these are public-site images behind an unguessable cuid.
 */

export const runtime = "nodejs";

export const GET = serveMediaAsset;
