import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { deriveVisits } from "../_shared/labels";
import { CustomersTable, type CustomerRow } from "./CustomersTable";

/**
 * Customers (CRM) directory — BACKOFHOUSE-IA F1. Owners see every customer;
 * artists are scoped to clients they have a booking with (PII guard, mirroring
 * /api/customers). Last/next visit are derived from the customer's bookings.
 */
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const artistId = owner ? undefined : (user.artistId ?? "__none__");

  const customers = await prisma.customer.findMany({
    where: artistId ? { bookings: { some: { artistId } } } : {},
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      loyaltyStamps: true,
      loyaltyTier: true,
      bookings: {
        where: {
          status: { in: ["enquiry", "pending", "confirmed", "completed"] },
          ...(artistId ? { artistId } : {}),
        },
        select: { start: true, status: true },
      },
    },
    take: 500,
  });

  const rows: CustomerRow[] = customers.map((c) => {
    const { lastVisit, nextVisit } = deriveVisits(c.bookings.map((b) => b.start));
    return {
      id: c.id,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      loyaltyStamps: c.loyaltyStamps,
      loyaltyTier: c.loyaltyTier,
      lastVisit,
      nextVisit,
    };
  });

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Customers
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        {owner
          ? "Everyone in the Bandit Pass. Search, sort, and open a timeline."
          : "Your clients — people you have a booking with."}
      </p>
      <div className="mt-8">
        <CustomersTable rows={rows} />
      </div>
    </main>
  );
}
