import "server-only";
/* CONTRACT (Phase 4 implements the bodies; Phase 6 imports these).
   Keep these exact signatures; add more files in src/lib/auth as needed. */
export type SessionRole = "OWNER" | "ARTIST";
export interface SessionUser {
  id: string;
  email: string;
  role: SessionRole;
  displayName: string;
  artistId?: string | null;
}
/** Returns the signed-in staff user, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  throw new Error("auth.getCurrentUser not implemented (Phase 4)");
}
/** Asserts a signed-in user (optionally of a given role); throws/redirects otherwise. */
export async function requireRole(_role?: SessionRole): Promise<SessionUser> {
  throw new Error("auth.requireRole not implemented (Phase 4)");
}
