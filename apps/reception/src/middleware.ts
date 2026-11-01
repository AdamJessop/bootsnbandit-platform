import { NextResponse, type NextRequest } from "next/server";
import { renewedSessionCookie } from "@bnb/core/auth/renewal";

/**
 * Reception session renewal (Edge middleware). The front-desk tablet is signed
 * in once by a staff member and then left on the desk, so a fixed 30-day
 * session would kick it back to /sign-in mid-day on day 30. A valid cookie in
 * the last half of its life is re-issued for another 30 days instead
 * (`renewedSessionCookie`): one decrypt per request, a cookie write only when
 * renewal is due.
 *
 * Deliberately not an auth guard — pages call `requireRole()` themselves (and
 * the kiosk server actions check `getCurrentUser()`), so a signed-out request
 * passes straight through.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.next();
  const name = process.env.SESSION_COOKIE || "bb_session";
  const renewed = await renewedSessionCookie(req.cookies.get(name)?.value);
  if (renewed) res.cookies.set(renewed.name, renewed.value, renewed.options);
  return res;
}

export const config = {
  // Every page + server-action POST; not Next internals, the API (the sign-in
  // ceremony + health check), the PWA assets or static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|bb-logo.png|robots.txt).*)",
  ],
};
