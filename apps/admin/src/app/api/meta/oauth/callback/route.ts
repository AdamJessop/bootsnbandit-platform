import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireRole } from "@bnb/core/auth";
import {
  connectMetaPages,
  metaRedirectUri,
  META_STATE_COOKIE,
} from "@bnb/core/services/channels/meta-oauth";

/**
 * GET /api/meta/oauth/callback — where Facebook Login for Business lands.
 *
 * Owner-only (a top-level GET navigation, so the Lax session cookie rides
 * along) and guarded by the single-use `state` nonce the connect action set.
 * Every outcome is a redirect back to Studio › Channels with a flash code —
 * the owner is in a browser, and an error page with a stack trace would be
 * both useless and a place for a Graph message to leak.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS_PATH = "/studio/channels";

function back(query: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `${CHANNELS_PATH}?${query}` },
  });
}

function sameNonce(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Meta's own error slugs are safe, short and useful; anything else is not. */
const SAFE_ERROR = /^[a-z_]{1,40}$/;

export async function GET(req: Request): Promise<Response> {
  // Redirects a signed-out visitor to /sign-in and an artist to their own
  // area — either way this returns before the `code` is looked at.
  await requireRole("OWNER");

  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const expected = jar.get(META_STATE_COOKIE)?.value ?? null;
  // Single use, whatever happens next: a replayed callback URL gets nothing.
  jar.delete(META_STATE_COOKIE);

  const denied = params.get("error");
  if (denied) {
    return back(
      `meta_error=${SAFE_ERROR.test(denied) ? denied : "access_denied"}`,
    );
  }

  const state = params.get("state");
  if (!expected || !state || !sameNonce(state, expected)) {
    return back("meta_error=bad_state");
  }

  const code = params.get("code");
  if (!code) return back("meta_error=no_code");

  try {
    const result = await connectMetaPages({
      code,
      // Must be byte-identical to the one the dialog was opened with, or Meta
      // rejects the exchange — hence the one shared helper.
      redirectUri: metaRedirectUri(),
    });
    // Zero rows means the account manages no usable Page. Saying "connected 0,
    // subscription failed" would send the owner hunting the wrong problem.
    if (result.connected.length === 0) return back("meta_error=no_pages");

    const query = [`meta_connected=${result.connected.length}`];
    if (result.warnings.length > 0) query.push("meta_warning=subscribe_failed");
    return back(query.join("&"));
  } catch (err) {
    // Graph's message can name the app and the token; it goes to the server
    // log, and the owner gets a slug plus the runbook.
    console.error("[meta] OAuth exchange failed:", err);
    return back("meta_error=exchange_failed");
  }
}
