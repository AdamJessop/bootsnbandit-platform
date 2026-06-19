import { runAllCron } from "@/lib/cron";
import { json } from "../../_lib/http";

/**
 * POST /api/cron/run — runs every CRM cron automation (reminders, review
 * requests, loyalty rewards) and returns a summary count.
 *
 * Guarded by the `CRON_SECRET`: the caller must present it in the
 * `x-cron-secret` header (or `Authorization: Bearer <secret>`). This is the
 * endpoint an external scheduler (system cron / Vercel Cron) hits — see
 * `docs/CRON.md`. Every job is idempotent, so repeated calls are safe.
 */
export const dynamic = "force-dynamic";

function presentedSecret(req: Request): string | null {
  const header = req.headers.get("x-cron-secret");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return json({ error: "CRON_SECRET is not configured" }, 503);
  }

  const presented = presentedSecret(req);
  if (!presented || presented !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const summary = await runAllCron();
  return json(summary, 200);
}
