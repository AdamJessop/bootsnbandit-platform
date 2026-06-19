import type { AdminRole } from "@/lib/admin-nav";

/**
 * Conditional render gate for role-scoped admin UI. Renders children only when
 * the current `role` is allowed. `ownerOnly` is the common case (Content /
 * Studio); `allow` permits an explicit role list. Role is passed as a prop for
 * now — real session-derived role wiring lands in Wave 3 (auth).
 */
export function RoleGate({
  role,
  ownerOnly = false,
  allow,
  fallback = null,
  children,
}: {
  role: AdminRole;
  ownerOnly?: boolean;
  allow?: AdminRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const permitted = allow
    ? allow.includes(role)
    : ownerOnly
      ? role === "owner"
      : true;
  return <>{permitted ? children : fallback}</>;
}
