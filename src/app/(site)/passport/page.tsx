import type { Metadata } from "next";
import Link from "next/link";
import { ornDot, SectionHead, Plate } from "@/components/site";
import { getLoyaltyConfig } from "../_data";
import { PassportCard } from "./PassportCard";
import styles from "./passport.module.css";

export const metadata: Metadata = {
  title: "The Bandit Pass · Boots 'n' Bandit",
  description:
    "Loyalty, reimagined. Collect a stamp for every piece and unlock birthday discounts, early flash access, priority booking and a free small tattoo.",
};

const SAMPLE_COLLECTION = [
  { title: "Fine-line fern", artist: "Amy", date: "Mar 2025" },
  { title: "Blackwork moth", artist: "Calum", date: "Jun 2025" },
  { title: "Colour koi", artist: "Alisha", date: "Sep 2025" },
  { title: "Ornamental snake", artist: "Sarah", date: "Jan 2026" },
];

export default async function PassportPage() {
  const cfg = await getLoyaltyConfig();
  const perks = cfg?.perks ?? [];
  const total = cfg?.rewardThreshold ?? 8;

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow gold">
            {ornDot()}
            Loyalty, reimagined
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            The Bandit Pass
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            A stamp for every piece you get done. Fill the card, unlock the
            perks — and your eighth tattoo is on us.
          </p>
        </div>
      </header>

      {/* HERO: card + progress */}
      <section className="section">
        <div className="wrap-wide">
          <div className={styles.hero}>
            <PassportCard
              holder="A. Collector"
              level="Level 2 · Outlaw"
              filled={4}
              total={total}
              since="2024"
            />
            <div>
              <SectionHead
                eyebrow="Your progress"
                title="4 stamps in, 4 to go"
                sub="Every completed tattoo earns a stamp. Keep collecting to climb the perks ladder."
              />
              <div className={styles.stats}>
                <div className={styles.statCell}>
                  <div className={styles.statNum}>4</div>
                  <div className={styles.statLabel}>Pieces</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statNum}>3</div>
                  <div className={styles.statLabel}>Artists</div>
                </div>
                <div className={styles.statCell}>
                  <div className={styles.statNum}>£85</div>
                  <div className={styles.statLabel}>Saved</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PERKS LADDER */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
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
      <section className="section">
        <div className="wrap-wide">
          <SectionHead eyebrow="On your card" title="Your collection" />
          <div className={styles.collection}>
            {SAMPLE_COLLECTION.map((c) => (
              <div key={c.title} className={styles.piece}>
                <Plate seed={`collection-${c.title}`} ratio="1/1" />
                <div className={styles.pieceMeta}>
                  <b>{c.title}</b>
                  <span>
                    {c.artist} · {c.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: 32 }}>
            <Link href="/enquire" className="btn btn-gold">
              Start your next piece
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
