/**
 * Back-of-house navigation registry. Single source of truth for the admin
 * AppShell (left sidebar ≥1024px, mobile bottom-nav <1024px) and route ids,
 * derived from docs/BACKOFHOUSE-IA.md. Wave-4 phases (P9/P10/P11) add the
 * actual screens at these `href`s.
 *
 * - `id`         stable route key (used by Wave-4 phases to target a section)
 * - `href`       route under / (admin origin root)
 * - `icon`       lucide icon component
 * - `ownerOnly`  hidden from artists by RoleGate / visibleNavItems
 * - `bottomNav`  surfaced in the mobile bottom bar (max 4 + a "More" sheet)
 */
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Inbox,
  CalendarCheck,
  Users,
  ReceiptText,
  CalendarOff,
  BarChart3,
  ImageIcon,
  Building2,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export type AdminRole = "owner" | "artist";

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  /** Show in the mobile bottom bar (≤4; the 5th slot is the "More" sheet). */
  bottomNav?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: "today",
    label: "Today",
    href: "/",
    icon: LayoutDashboard,
    bottomNav: true,
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    bottomNav: true,
  },
  {
    id: "front-desk",
    label: "Front Desk",
    href: "/front-desk",
    icon: ClipboardList,
    bottomNav: true,
  },
  {
    id: "enquiries",
    label: "Enquiries",
    href: "/enquiries",
    icon: Inbox,
  },
  {
    id: "bookings",
    label: "Bookings",
    href: "/bookings",
    icon: CalendarCheck,
  },
  {
    id: "customers",
    label: "Customers",
    href: "/customers",
    icon: Users,
    bottomNav: true,
  },
  {
    id: "sessions",
    label: "Sessions",
    href: "/sessions",
    icon: ReceiptText,
  },
  {
    id: "availability",
    label: "Availability",
    href: "/availability",
    icon: CalendarOff,
  },
  { id: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
  {
    id: "content",
    label: "Content",
    href: "/content",
    icon: ImageIcon,
    ownerOnly: true,
  },
  {
    id: "studio",
    label: "Studio",
    href: "/studio",
    icon: Building2,
    ownerOnly: true,
  },
  {
    id: "profile",
    label: "My Profile",
    href: "/profile",
    icon: UserCircle,
  },
];

/** Items a given role may see (owners see all; artists lose owner-only). */
export function visibleNavItems(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => role === "owner" || !item.ownerOnly);
}

/**
 * Up to 4 items for the mobile bottom bar, role-filtered — the AppShell adds
 * a 5th "More" slot opening a sheet of the remaining (moreNavItems) sections.
 */
export function bottomNavItems(role: AdminRole): AdminNavItem[] {
  return visibleNavItems(role)
    .filter((item) => item.bottomNav)
    .slice(0, 4);
}

/**
 * Role-filtered items NOT in the bottom bar — the mobile "More" sheet. Derived
 * from the same registry as the sidebar so role gating stays single-sourced,
 * and together with bottomNavItems covers every visible section (no mobile
 * dead-ends).
 */
export function moreNavItems(role: AdminRole): AdminNavItem[] {
  const bottomIds = new Set(bottomNavItems(role).map((item) => item.id));
  return visibleNavItems(role).filter((item) => !bottomIds.has(item.id));
}
