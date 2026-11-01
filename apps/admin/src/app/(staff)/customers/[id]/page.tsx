import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { visibleEnquiryWhere } from "@bnb/core/services/enquiry-messages";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { CustomerTimeline } from "@/components/admin/CustomerTimeline";
import { loyaltyTierLabel } from "../../_shared/labels";
import { buildTimeline } from "./timeline-builder";
import { buildConsentRecords } from "./consent-records";
import { ConsentForms } from "./ConsentForms";
import { CustomerActions } from "./CustomerActions";
import { buildIdentityChips, IdentityChips } from "./IdentityChips";
import { LinkIdentityCard } from "./LinkIdentityCard";

/**
 * Customer detail (BACKOFHOUSE-IA F2): unified timeline (enquiries + bookings +
 * sessions + emails + loyalty), notes, marketing consent and manual email,
 * plus the read-only kiosk consent forms. Owners see anyone; artists only
 * customers they have a booking with — and only the consent forms from their
 * own bookings.
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
  const viewer = {
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  };

  const customer = await prisma.customer.findFirst({
    where: { id, ...guard },
    include: {
      // Scoped exactly like the thread messages below. An artist who shares a
      // booking with this customer can open their record, but that must not
      // become a side door onto enquiries the inbox would never show them —
      // another artist's leads, complete with a link straight into the thread.
      enquiries: {
        where: visibleEnquiryWhere(viewer),
        orderBy: { createdAt: "desc" },
      },
      bookings: {
        orderBy: { start: "desc" },
        include: {
          artist: { select: { name: true } },
          session: true,
          consentForm: true,
        },
      },
      messages: { orderBy: { createdAt: "desc" } },
      identities: { orderBy: { createdAt: "asc" } },
      enquiryMessages: {
        // The customer record must never widen what the inbox would show: an
        // artist reads only the threads they could open there.
        where: { enquiry: visibleEnquiryWhere(viewer) },
        orderBy: { createdAt: "desc" },
        // A long-running customer can have hundreds of messages; the timeline
        // is a summary, not an archive — the thread itself is one click away.
        take: 100,
        select: {
          id: true,
          enquiryId: true,
          createdAt: true,
          direction: true,
          channel: true,
          bodyText: true,
        },
      },
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

  const consentRecords = buildConsentRecords(customer.bookings, {
    role: user.role,
    artistId: user.artistId ?? null,
  });

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
    threadMessages: customer.enquiryMessages.map((m) => ({
      id: m.id,
      enquiryId: m.enquiryId,
      createdAt: m.createdAt.toISOString(),
      direction: m.direction,
      channel: m.channel,
      bodyText: m.bodyText,
    })),
    loyalty: { stamps: customer.loyaltyStamps, tier: customer.loyaltyTier },
  });

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-4" /> Customers
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
            {customer.name}
          </h1>
          <IdentityChips
            chips={buildIdentityChips({
              email: customer.email,
              phone: customer.phone,
              identities: customer.identities,
            })}
          />
          {customer.email ||
          customer.phone ||
          customer.identities.length ? null : (
            <p className="mt-1 text-sm text-text-muted">No contact details</p>
          )}
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
          <h2 className="mt-10 mb-4 font-termina text-xs uppercase tracking-wide text-text-muted">
            Consent forms
          </h2>
          <ConsentForms records={consentRecords} customerId={customer.id} />
        </section>
        <aside>
          <CustomerActions
            customerId={customer.id}
            initialNotes={customer.notes ?? ""}
            initialConsent={customer.marketingConsent}
            hasEmail={Boolean(customer.email)}
          />
          {/* Owner-only: an artist is never offered the merge, and the list
              behind it is not fetched at all until an owner presses the
              button inside the card. */}
          {owner && <LinkIdentityCard customerId={customer.id} />}
        </aside>
      </div>
      <Toaster position="top-center" />
    </main>
  );
}
