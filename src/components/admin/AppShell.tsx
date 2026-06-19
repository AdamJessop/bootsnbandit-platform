"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Search, UserCircle } from "lucide-react";
import { cn } from "@bnb/core/utils";
import {
  visibleNavItems,
  bottomNavItems,
  type AdminRole,
} from "@/lib/admin-nav";
import { Mark } from "@/components/site/Mark";

/**
 * Responsive back-of-house shell. ≥1024px: persistent left sidebar + top bar.
 * <1024px: top bar + fixed bottom-nav. Driven by the admin-nav registry and
 * role-filtered (owner-only items hidden for artists). Calmer than the public
 * site — denser, minimal ornament.
 *
 * `role` is a prop today; real session role wiring arrives in Wave 3 (auth).
 */
export function AppShell({
  role = "owner",
  children,
}: {
  role?: AdminRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = visibleNavItems(role);
  const bottom = bottomNavItems(role);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-bg-base text-text-secondary">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border-default bg-bg-base lg:flex">
        <Link
          href="/admin"
          className="flex h-16 items-center gap-2.5 border-b border-border-default px-5"
        >
          <Mark className="h-7 w-7 text-bb-crimson" />
          <span className="font-termina text-sm font-bold tracking-wide text-text-primary">
            Boots &rsquo;n&rsquo; Bandit
          </span>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 font-termina text-[13px] font-medium uppercase tracking-wide transition-colors",
                  isActive(item.href)
                    ? "bg-bb-crimson/15 text-text-primary"
                    : "text-text-muted hover:bg-bg-raised hover:text-text-primary",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.ownerOnly && (
                  <Crown
                    className="h-3.5 w-3.5 text-bb-gold"
                    aria-label="Owner only"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-3 border-b border-border-default bg-bg-default/90 px-4 backdrop-blur lg:left-60">
        <Link href="/admin" className="flex items-center gap-2 lg:hidden">
          <Mark className="h-6 w-6 text-bb-crimson" />
        </Link>
        <div className="hidden items-center gap-2 rounded-md border border-border-default bg-bg-raised px-3 py-1.5 text-sm text-text-muted sm:flex">
          <Search className="h-4 w-4" />
          <span>Search customers, bookings…</span>
        </div>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 rounded-full border border-bb-gold/40 bg-bb-gold/10 px-2.5 py-1 font-termina text-[11px] font-bold uppercase tracking-wider text-bb-gold">
          {role === "owner" ? <Crown className="h-3.5 w-3.5" /> : null}
          {role}
        </span>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md border border-border-default bg-bg-raised text-text-secondary"
          aria-label="Profile"
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </header>

      {/* Content */}
      <div className="pt-16 pb-20 lg:pb-0 lg:pl-60">{children}</div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col border-t border-border-default bg-bg-base/95 backdrop-blur lg:hidden">
        {bottom.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 font-termina text-[10px] font-bold uppercase tracking-wide",
                isActive(item.href) ? "text-bb-crimson" : "text-text-muted",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
