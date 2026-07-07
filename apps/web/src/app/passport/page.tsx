import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@bnb/core/db";
import { ornDot, SectionHead, Plate } from "@/components/site";
import { requireCustomer } from "@/lib/customer-auth";
import { signOutAction } from "@/app/account/actions";
import { getLoyaltyConfig } from "../_data";
import { PassportCard } from "./PassportCard";
import { BookingsList, type PassportBooking } from "./BookingsList";
import styles from "./passport.module.css";

export const metadata: Metadata = {
  title: "The Bandit Pass · Boots 'n' Bandit",
  description:
    "Your Bandit Pass account — bookings, stamps and the perks ladder.",
};

export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

function toRow(b: {
  id: string;
  style: string | null;
  start: Date;
  status: string;
  cancelRequestedAt: Date | null;
  artist: { name: string };
}): PassportBooking {
  return {
    id: b.id,
    artistName: b.artist.name,
    startISO: b.start.toISOString(),
    style: b.style,
    status: b.status,
    cancelRequested: b.cancelRequestedAt != null,
  };
}

export default async function PassportPage() {
  const session = await requireCustomer();

  const [customer, cfg, bookings] = await Promise.all([
    prisma.customer.findUnique({ where: { id: session.sub } }),
    getLoyaltyConfig(),
    prisma.booking.findMany({
      where: {
        customerId: session.sub,
        status: { in: ["pending", "confirmed", "completed"] },
      },
      orderBy: { start: "asc" },
      select: {
        id: true,
        style: true,
        start: true,
        status: true,
        cancelRequestedAt: true,
        artist: { select: { name: true } },
      },
    }),
  ]);

  const perks = cfg?.perks ?? [];
  const total = cfg?.rewardThreshold ?? 8;
  const stamps = customer?.loyaltyStamps ?? 0;
  const tier = customer?.loyaltyTier ?? 0;
  const holder = customer?.name ?? session.name;

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.status !== "completed" && b.start.getTime() >= now)
    .map(toRow);
  const completed = bookings.filter((b) => b.status === "completed");
  const past = completed.slice().reverse().map(toRow);
  const distinctArtists = new Set(completed.map((b) => b.artist.name)).size;

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow gold">
            {ornDot()}
            Your Bandit Pass
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Welcome back, {holder.split(" ")[0]}
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            A stamp for every piece you get done. Fill the card, unlock the
            perks.
          </p>
          <form action={signOutAction} style={{ marginTop: 14 }}>
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* HERO: card + progress */}
      <section className="section">
        <div className="wrap-wide">
          <div className={styles.hero}>
            <PassportCard
              holder={holder}
              level={`Level ${tier}`}
              filled={Math.min(stamps, total)}
              total={total}
              since={
                customer ? String(customer.createdAt.getFullYear()) : undefined
              }
            />
            <div>
              <SectionHead
                eyebrow="Your progress"
                title={`${stamps} stamp${stamps === 1 ? "" : "s"} in, ${Math.max(0, total - stamps)} to go`}
                sub="Every completed tattoo earns a stamp. Keep collecting to climb the perks ladder."
              />
              <div className={styles.stats}>
                <div className={styles.statCell}>
                  <div className={styles.statNum}>{completed.length}</div>
                  <div className={styles.statLabel}>Pieces</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statNum}>{distinctArtists}</div>
                  <div className={styles.statLabel}>Artists</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statNum}>{stamps}</div>
                  <div className={styles.statLabel}>Stamps</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOOKINGS */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap-wide">
          <SectionHead eyebrow="Your appointments" title="Bookings" />
          <BookingsList upcoming={upcoming} past={past} />
        </div>
      </section>

      {/* PERKS LADDER */}
      <section className="section">
        <div className="wrap-wide">
          <SectionHead eyebrow="The rewards" title="Perks ladder" />
          <div className={styles.perks}>
            {perks.map((p) => (
              <div key={p.stamps} className={`card card-pad ${styles.perk}`}>
                <span className={styles.perkNum}>{p.stamps}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COLLECTION */}
      {completed.length > 0 && (
        <section className="section" style={{ background: "var(--bg-base)" }}>
          <div className="wrap-wide">
            <SectionHead eyebrow="On your card" title="Your collection" />
            <div className={styles.collection}>
              {completed.map((c) => (
                <div key={c.id} className={styles.piece}>
                  <Plate seed={`collection-${c.id}`} ratio="1/1" />
                  <div className={styles.pieceMeta}>
                    <b>{c.style ?? "Tattoo"}</b>
                    <span>
                      {c.artist.name} · {DATE.format(c.start)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap-wide center">
          <Link href="/enquire" className="btn btn-gold">
            Start your next piece
          </Link>
        </div>
      </section>
    </div>
  );
}
