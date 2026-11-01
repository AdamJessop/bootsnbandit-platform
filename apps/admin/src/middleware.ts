import { NextResponse, type NextRequest } from "next/server";
import { renewedSessionCookie } from "@bnb/core/auth/renewal";

/**
 * Admin auth guard (Edge middleware). The staff PWA is its own origin
 * (admin.<domain>); every screen is back-of-house. A signed-out visitor is
 * redirected to /sign-in before any staff route renders.
 *
 * This is a cheap *presence* check on the session cookie — the cryptographic
 * verification still happens in `requireRole()` (server components / route
 * handlers) which runs in the Node runtime. The middleware just keeps
 * unauthenticated browsers off the app shell. The cookie name is env-driven
 * (`SESSION_COOKIE`) so it stays in lockstep with `@bnb/core` auth config
 * (P4 scopes it to the admin origin).
 *
 * It also slides the session: a valid cookie in the last half of its 30-day
 * life is re-issued for another 30 days (`renewedSessionCookie`), so staff who
 * use the app regularly are never signed out mid-shift. Decrypt-only unless a
 * renewal is due — no DB, no write on every request.
 */
const SESSION_COOKIE = process.env.SESSION_COOKIE || "bb_session";

// Routes reachable while signed out. `/media` serves CMS images (public-site
// content behind unguessable ids); browsers fetch it as an <img>, so a
// redirect to /sign-in would just break the image.
const PUBLIC_PREFIXES = ["/sign-in", "/media"];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublic) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    const res = NextResponse.next();
    const renewed = await renewedSessionCookie(session);
    if (renewed) res.cookies.set(renewed.name, renewed.value, renewed.options);
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Guard every route except Next internals, the API (route handlers enforce
  // their own auth + must stay reachable for the sign-in ceremony), the PWA
  // assets, and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|bb-logo.png|robots.txt).*)",
  ],
};
