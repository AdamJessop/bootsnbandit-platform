import { AppShell } from "@/components/admin/AppShell";
import { requireRole } from "@bnb/core/auth";
import { unreadCountsFor } from "@bnb/core/services/enquiry-messages";
import type { AdminRole } from "@/lib/admin-nav";

/**
 * Staff PWA shell — (admin) route group. Every back-of-house screen requires a
 * signed-in staff user (requireRole redirects to /sign-in otherwise). The
 * session role (OWNER/ARTIST) is mapped to the AppShell's AdminRole so nav is
 * correctly scoped per user, and the unread enquiry count (scoped the same
 * way) drives the Enquiries badge.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireRole();
  const role: AdminRole = user.role === "OWNER" ? "owner" : "artist";
  const unread = await unreadCountsFor({
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  });
  return (
    <AppShell role={role} enquiriesUnread={unread.total}>
      {children}
    </AppShell>
  );
}
