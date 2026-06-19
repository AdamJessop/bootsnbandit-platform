import Link from "next/link";
import {
  Image as ImageIcon,
  Sparkles,
  Users,
  Palette,
  HeartPulse,
  HelpCircle,
  Stamp,
  Settings,
  ArrowRight,
} from "lucide-react";
import { requireRole } from "@/lib/auth";

/**
 * Content CMS hub (BACKOFHOUSE-IA J). Owner-only. Links to each manageable
 * content area that the public site renders from the database.
 */

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/admin/content/gallery",
    label: "Gallery",
    desc: "Portfolio pieces — image, artist, style, placement, featured.",
    icon: ImageIcon,
  },
  {
    href: "/admin/content/flash",
    label: "Flash",
    desc: "Flash designs — price, size, claim tracking, deadline.",
    icon: Sparkles,
  },
  {
    href: "/admin/content/artists",
    label: "Artists",
    desc: "Profiles — bio, styles, rates, books status, headshot.",
    icon: Users,
  },
  {
    href: "/admin/content/styles",
    label: "Styles",
    desc: "The tattoo styles list used across filters.",
    icon: Palette,
  },
  {
    href: "/admin/content/aftercare",
    label: "Aftercare",
    desc: "Ordered aftercare stages emailed after a session.",
    icon: HeartPulse,
  },
  {
    href: "/admin/content/faq",
    label: "FAQ",
    desc: "Questions & answers shown on the public site.",
    icon: HelpCircle,
  },
  {
    href: "/admin/content/loyalty",
    label: "Loyalty (Bandit Pass)",
    desc: "Stamps, thresholds, perks ladder and messaging.",
    icon: Stamp,
  },
  {
    href: "/admin/content/site",
    label: "Site settings",
    desc: "Studio details, hours, ticker, socials, enquiries toggle.",
    icon: Settings,
  },
];

export default async function ContentHubPage() {
  await requireRole("OWNER");
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(26px,4vw,40px)] text-text-primary">
        Content
      </h1>
      <p className="mt-3 max-w-[60ch] text-text-muted">
        Everything the public site renders is managed here.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-4 rounded-lg border border-border-default bg-bg-card p-5 transition-colors hover:border-bb-crimson/50"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-bb-crimson/12 text-bb-crimson">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
                  {s.label}
                  <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  {s.desc}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
