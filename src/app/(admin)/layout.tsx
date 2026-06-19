import { AppShell } from "@/components/admin/AppShell";

/**
 * Staff PWA shell — (admin) route group. Wraps every back-of-house screen in
 * the responsive AppShell (sidebar + top bar + mobile bottom-nav), driven by
 * the admin-nav registry. Role is hard-coded to "owner" until auth lands in
 * Wave 3; swap to the session role then.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell role="owner">{children}</AppShell>;
}
