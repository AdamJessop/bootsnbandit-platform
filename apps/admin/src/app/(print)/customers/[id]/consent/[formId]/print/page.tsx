import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { buildConsentRecords } from "@/app/(staff)/customers/[id]/consent-records";
import { ConsentPrintSheet, ConsentPrintStyles } from "./ConsentPrintSheet";
import { PrintButton } from "./PrintButton";

/**
 * Print-friendly view of one signed consent form, laid out like the studio's
 * paper Client Consent Form — what the studio shows the council on
 * inspection. Outside the staff shell (its own route group) so the page is
 * just the form. Same visibility as the customer record: an owner sees any
 * form, an artist only forms on their own bookings; anything else is a 404
 * so the URL never confirms a form exists.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client consent form — Boots 'n' Bandit",
};

export default async function ConsentPrintPage({
  params,
}: {
  params: Promise<{ id: string; formId: string }>;
}) {
  const { id, formId } = await params;
  const user = await requireRole();

  const booking = await prisma.booking.findFirst({
    where: { customerId: id, consentForm: { is: { id: formId } } },
    include: { artist: { select: { name: true } }, consentForm: true },
  });
  const [record] = booking
    ? buildConsentRecords([booking], {
        role: user.role,
        artistId: user.artistId ?? null,
      })
    : [];
  if (!record) notFound();

  return (
    <main className="cp">
      <ConsentPrintStyles />
      <div className="cp-bar no-print">
        <Link href={`/customers/${id}`}>← Back to the customer</Link>
        <PrintButton />
      </div>
      <ConsentPrintSheet record={record} />
    </main>
  );
}
