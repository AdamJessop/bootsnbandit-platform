import { serveMediaAsset } from "@bnb/core/http/media";

/**
 * GET /media/[id] — CMS images (gallery / flash / styles / headshots) for the
 * public pages. Bytes live in Postgres; the shared handler in @bnb/core is
 * mounted identically on admin so the CMS can preview the same URL.
 */

export const runtime = "nodejs";

export const GET = serveMediaAsset;
