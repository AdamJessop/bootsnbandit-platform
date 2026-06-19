/**
 * Staff PWA shell — (admin) route group.
 * Calmer heritage subset. AppShell (sidebar/topbar/bottomnav + RoleGate)
 * is built in Phase 3; auth gating in Phase 4.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative z-[1] min-h-dvh bg-bg-base text-text-secondary">
      {children}
    </div>
  );
}
