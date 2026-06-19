import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, Heart } from "lucide-react";
import { ornDot, SectionHead } from "@/components/site";
import { getAftercareStages, getFaqs } from "../_data";
import { HealingTracker } from "./HealingTracker";
import { FaqAccordion } from "./FaqAccordion";
import styles from "./aftercare.module.css";

export const metadata: Metadata = {
  title: "Aftercare · Boots 'n' Bandit",
  description:
    "How to look after a new tattoo, day by day — our five healing stages, the dos and don'ts, and answers to the questions we hear most.",
};

const DOS = [
  "Wash gently with lukewarm water and fragrance-free soap.",
  "Moisturise thinly — a little balm goes a long way.",
  "Protect it from the sun; SPF 30+ once it's healed.",
];

const DONTS = [
  "Don't pick or scratch, however itchy it gets.",
  "No soaking, pools, baths or saunas for 2–3 weeks.",
  "No tight clothing or straps over the fresh tattoo.",
];

export default async function AftercarePage() {
  const [stages, faqs] = await Promise.all([getAftercareStages(), getFaqs()]);

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow">
            {ornDot()}
            Look after it
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Aftercare
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            A great tattoo is half the artist, half the healing. Here&rsquo;s
            exactly what to do — and what to expect — every step of the way.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="wrap-wide">
          <SectionHead eyebrow="Healing tracker" title="Where are you up to?" />
          <HealingTracker stages={stages} />
        </div>
      </section>

      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap-wide">
          <SectionHead eyebrow="The basics" title="Do & don't" />
          <div className={styles.dosGrid}>
            <div className={`card card-pad ${styles.dosCard} ${styles.do}`}>
              <h3>Do</h3>
              <ul className={styles.dosList}>
                {DOS.map((d) => (
                  <li key={d}>
                    <Check className="ic teal" /> {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`card card-pad ${styles.dosCard} ${styles.dont}`}>
              <h3>Don&rsquo;t</h3>
              <ul className={styles.dosList}>
                {DONTS.map((d) => (
                  <li key={d}>
                    <X className="ic crimson" /> {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className={`card card-pad ${styles.helpCard}`}
            style={{ marginTop: 20 }}
          >
            <div className="row gap-3" style={{ marginBottom: 8 }}>
              <Heart className="ic gold" />
              <b>Something not right?</b>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Drop us a message any time — we&rsquo;d always rather take a look.
              All our work comes with free touch-ups within three months.{" "}
              <Link href="/enquire" className="gold">
                Get in touch &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap-wide">
          <SectionHead eyebrow="Good to know" title="Frequently asked" />
          <FaqAccordion
            faqs={faqs.map((f) => ({
              id: f.id,
              question: f.question,
              answer: f.answer,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
