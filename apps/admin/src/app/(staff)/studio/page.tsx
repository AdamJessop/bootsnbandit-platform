import Link from "next/link";
import { Users, Armchair, Mail, Plug, ArrowRight } from "lucide-react";
import { requireRole } from "@bnb/core/auth";

/** Studio admin hub (BACKOFHOUSE-IA K). Owner-only. */
export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/studio/staff",
    label: "Staff & users",
    desc: "Invite staff, set roles, enable/disable, manage passkeys.",
    icon: Users,
  },
  {
    href: "/studio/resources",
    label: "Resources",
    desc: "Chairs / stations used for utilisation.",
    icon: Armchair,
  },
  {
    href: "/studio/email-templates",
    label: "Email templates",
    desc: "Preview the transactional email templates.",
    icon: Mail,
  },
  {
    href: "/studio/integrations",
    label: "Integrations",
    desc: "iCal feed status, Resend status, Google (later).",
    icon: Plug,
  },
];

export default async function StudioHubPage() {
  await requireRole("OWNER");
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(26px,4vw,40px)] text-text-primary">
        Studio
      </h1>
      <p className="mt-3 max-w-[60ch] text-text-muted">
        People, resources, templates and integrations.
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
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-bb-gold/12 text-bb-gold">
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
