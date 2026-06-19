import { AppShell } from "@/components/admin/AppShell";
import { requireRole } from "@bnb/core/auth";
import type { AdminRole } from "@/lib/admin-nav";

/**
 * Staff PWA shell — (admin) route group. Every back-of-house screen requires a
 * signed-in staff user (requireRole redirects to /sign-in otherwise). The
 * session role (OWNER/ARTIST) is mapped to the AppShell's AdminRole so nav is
 * correctly scoped per user.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireRole();
  const role: AdminRole = user.role === "OWNER" ? "owner" : "artist";
  return <AppShell role={role}>{children}</AppShell>;
}
