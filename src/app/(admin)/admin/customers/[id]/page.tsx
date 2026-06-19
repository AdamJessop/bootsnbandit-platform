import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { CustomerTimeline } from "@/components/admin/CustomerTimeline";
import { loyaltyTierLabel } from "../../_shared/labels";
import { buildTimeline } from "./timeline-builder";
import { CustomerActions } from "./CustomerActions";

/**
 * Customer detail (BACKOFHOUSE-IA F2): unified timeline (enquiries + bookings +
 * sessions + emails + loyalty), notes, marketing consent and manual email.
 * Owners see anyone; artists only customers they have a booking with.
 */
export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const guard = owner
    ? {}
    : { bookings: { some: { artistId: user.artistId ?? "__none__" } } };

  const customer = await prisma.customer.findFirst({
    where: { id, ...guard },
    include: {
      enquiries: { orderBy: { createdAt: "desc" } },
      bookings: {
        orderBy: { start: "desc" },
        include: {
          artist: { select: { name: true } },
          session: true,
        },
      },
      messages: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!customer) notFound();

  const sessions = customer.bookings
    .filter((b) => b.session)
    .map((b) => ({
      id: b.session!.id,
      completedAt: b.session!.completedAt.toISOString(),
      amountChargedPence: b.session!.amountChargedPence,
      tipPence: b.session!.tipPence,
    }));

  const entries = buildTimeline({
    enquiries: customer.enquiries.map((e) => ({
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      style: e.style,
      status: e.status,
    })),
    bookings: customer.bookings.map((b) => ({
      id: b.id,
      start: b.start.toISOString(),
      type: b.type,
      status: b.status,
      artistName: b.artist.name,
    })),
    sessions,
    messages: customer.messages.map((m) => ({
      id: m.id,
      sentAt: m.sentAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      type: m.type,
      status: m.status,
      subject: m.subject,
    })),
    loyalty: { stamps: customer.loyaltyStamps, tier: customer.loyaltyTier },
  });

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-4" /> Customers
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
            {customer.name}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {customer.email || "No email"}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={customer.loyaltyTier > 0 ? "default" : "outline"}>
            {loyaltyTierLabel(customer.loyaltyTier)}
          </Badge>
          <span className="tabular-nums text-sm text-text-muted">
            {customer.loyaltyStamps}★ stamps
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="mb-4 font-termina text-xs uppercase tracking-wide text-text-muted">
            Timeline
          </h2>
          <CustomerTimeline customerId={customer.id} entries={entries} />
        </section>
        <aside>
          <CustomerActions
            customerId={customer.id}
            initialNotes={customer.notes ?? ""}
            initialConsent={customer.marketingConsent}
            hasEmail={Boolean(customer.email)}
          />
        </aside>
      </div>
      <Toaster position="top-center" />
    </main>
  );
}
