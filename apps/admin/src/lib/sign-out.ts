/**
 * Sign-out glue for the AppShell profile menu. POSTs /api/auth/logout (clears
 * the session cookie) then hard-navigates to /sign-in — a full document load so
 * every server component re-renders unauthenticated. Deps are injectable so the
 * flow unit-tests in node.
 */

export interface SignOutDeps {
  fetchFn?: typeof fetch;
  navigate?: (href: string) => void;
}

export async function signOut({
  fetchFn = fetch,
  navigate = (href) => window.location.assign(href),
}: SignOutDeps = {}): Promise<void> {
  try {
    await fetchFn("/api/auth/logout", { method: "POST" });
  } catch {
    // Best-effort: even offline, land on /sign-in — requireRole() bounces the
    // user back in if the session cookie somehow survived.
  }
  navigate("/sign-in");
}
