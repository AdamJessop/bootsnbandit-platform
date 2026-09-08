"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Crown,
  LogOut,
  MoreHorizontal,
  Search,
  UserCircle,
} from "lucide-react";
import { cn } from "@bnb/core/utils";
import {
  visibleNavItems,
  bottomNavItems,
  moreNavItems,
  type AdminRole,
} from "@/lib/admin-nav";
import { shouldRefreshNow, UNREAD_POLL_MS } from "@/lib/refresh-poll";
import { signOut } from "@/lib/sign-out";
import { InstallPrompt } from "@/components/admin/InstallPrompt";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Unread count pill on a nav item; nothing at all when there is nothing new. */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="grid min-w-5 place-items-center rounded-full bg-bb-crimson px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
      role="img"
      aria-label={`${count} unread enquiries`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Responsive back-of-house shell. ≥1024px: persistent left sidebar + top bar.
 * <1024px: top bar + fixed bottom-nav (4 pinned items + a "More" sheet with
 * every remaining section). Driven by the admin-nav registry and role-filtered
 * (owner-only items hidden for artists). The top-bar account menu links to
 * My Profile and signs out (POST /api/auth/logout → /sign-in). Calmer than the
 * public site — denser, minimal ornament.
 */
export function AppShell({
  role = "owner",
  enquiriesUnread = 0,
  children,
}: {
  role?: AdminRole;
  /** Unread enquiry threads for this user — badged on the Enquiries item. */
  enquiriesUnread?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Keep the unread badge honest without a socket: the same 60 s refresh the
  // kiosk board uses, asleep while the tab is hidden. force-dynamic pages
  // re-render server-side on refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!shouldRefreshNow(document.visibilityState)) return;
      router.refresh();
    }, UNREAD_POLL_MS);
    // Coming back to the tab should not mean staring at a stale badge for the
    // rest of the interval.
    const onVisibility = () => {
      if (shouldRefreshNow(document.visibilityState)) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);
  const items = visibleNavItems(role);
  const bottom = bottomNavItems(role);
  const more = moreNavItems(role);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-bg-base text-text-secondary">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border-default bg-bg-base lg:flex">
        <Link
          href="/"
          className="flex h-16 items-center gap-2.5 border-b border-border-default px-5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bb-logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
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
                {item.id === "enquiries" && (
                  <UnreadBadge count={enquiriesUnread} />
                )}
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
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bb-logo.png"
            alt="Boots 'n' Bandit"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </Link>
        <div className="hidden items-center gap-2 rounded-md border border-border-default bg-bg-raised px-3 py-1.5 text-sm text-text-muted sm:flex">
          <Search className="h-4 w-4" />
          <span>Search customers, bookings…</span>
        </div>
        <span className="flex-1" />
        <InstallPrompt />
        <span className="flex items-center gap-1.5 rounded-full border border-bb-gold/40 bg-bb-gold/10 px-2.5 py-1 font-termina text-[11px] font-bold uppercase tracking-wider text-bb-gold">
          {role === "owner" ? <Crown className="h-3.5 w-3.5" /> : null}
          {role}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="grid h-9 w-9 place-items-center rounded-md border border-border-default bg-bg-raised text-text-secondary hover:text-text-primary"
            aria-label="Account"
          >
            <UserCircle className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem render={<Link href="/profile" />}>
              <UserCircle className="h-4 w-4" /> My profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Content */}
      <div className="pt-16 pb-20 lg:pb-0 lg:pl-60">{children}</div>

      {/* Bottom nav (mobile): 4 pinned items + a "More" sheet so every
          role-visible section stays reachable on small screens. */}
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
              <span className="flex items-center gap-1">
                {item.label}
                {item.id === "enquiries" && (
                  <UnreadBadge count={enquiriesUnread} />
                )}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 font-termina text-[10px] font-bold uppercase tracking-wide",
            more.some((item) => isActive(item.href))
              ? "text-bb-crimson"
              : "text-text-muted",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* "More" sheet: the remaining role-filtered sections (same registry as
          the sidebar, so role gating stays single-sourced). */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-8 lg:hidden">
          <SheetHeader>
            <SheetTitle className="font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
              More
            </SheetTitle>
          </SheetHeader>
          <nav className="grid grid-cols-3 gap-2 px-4">
            {more.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-md border border-border-default px-2 py-3 text-center font-termina text-[10px] font-bold uppercase tracking-wide",
                    isActive(item.href)
                      ? "bg-bb-crimson/15 text-text-primary"
                      : "text-text-muted hover:bg-bg-raised hover:text-text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex items-center gap-1">
                    {item.label}
                    {item.id === "enquiries" && (
                      <UnreadBadge count={enquiriesUnread} />
                    )}
                    {item.ownerOnly && (
                      <Crown
                        className="h-3 w-3 text-bb-gold"
                        aria-label="Owner only"
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
