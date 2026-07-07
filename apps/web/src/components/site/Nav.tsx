"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Menu, X } from "lucide-react";
import { cn } from "@bnb/core/utils";
import { SITE_NAV, STUDIO } from "@/lib/site-nav";

/**
 * Sticky public nav: brand mark, primary links (active highlight), Bandit Pass
 * + "Make an enquiry" actions, and a mobile burger menu. Routes are placeholders
 * until the marketing pages land.
 */
export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="nav">
      <div className="nav-in">
        <Link href="/" className="brand" aria-label={STUDIO.name}>
          <span className="brand-mark" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bb-logo.png"
              alt=""
              width={46}
              height={46}
              className="h-[46px] w-[46px] object-contain"
            />
          </span>
          <span className="brand-txt">
            <b>Boots &rsquo;n&rsquo; Bandit</b>
            <small>Tattoo Studio</small>
          </span>
        </Link>

        <div className="nav-links">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-link", isActive(item.href) && "on")}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <span className="nav-spacer" />

        <div className="nav-actions">
          <Link
            href="/passport"
            className="icon-btn"
            aria-label="Bandit Pass"
            title="Bandit Pass"
          >
            <Award className="ic" />
          </Link>
          <Link href="/enquire" className="btn btn-sm">
            Make an enquiry
          </Link>
          <button
            type="button"
            className="icon-btn nav-burger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="ic" /> : <Menu className="ic" />}
          </button>
        </div>
      </div>

      <div className={cn("mobile-menu", open && "open")}>
        {SITE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn("mm-link", isActive(item.href) && "on")}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/passport"
          className="mm-link"
          onClick={() => setOpen(false)}
        >
          Bandit Pass
        </Link>
      </div>
    </nav>
  );
}
