import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  X,
  Heart,
  Droplet,
  Sun,
  Hand,
  Waves,
  Shirt,
  ArrowRight,
} from "lucide-react";
import { ornDot, SectionHead } from "@/components/site";
import { getAftercareStages, getFaqs } from "../_data";
import { HealingTracker } from "./HealingTracker";
import { FaqAccordion } from "./FaqAccordion";
import styles from "./aftercare.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aftercare · Boots 'n' Bandit",
  description:
    "How to look after a new tattoo, day by day — our five healing stages, the dos and don'ts, and answers to the questions we hear most.",
};

const DOS = [
  {
    icon: Droplet,
    title: "Wash gently",
    desc: "Lukewarm water and fragrance-free soap, twice a day.",
  },
  {
    icon: Heart,
    title: "Moisturise thinly",
    desc: "A little balm goes a long way — never slather it.",
  },
  {
    icon: Sun,
    title: "Protect it from the sun",
    desc: "Keep it covered while healing; SPF 30+ forever after.",
  },
];

const DONTS = [
  {
    icon: Hand,
    title: "Don't pick or scratch",
    desc: "However itchy it gets — tap it instead.",
  },
  {
    icon: Waves,
    title: "No soaking for 2–3 weeks",
    desc: "No pools, baths, hot tubs or saunas. Short showers only.",
  },
  {
    icon: Shirt,
    title: "No tight clothing",
    desc: "Nothing rubbing on it — loose, clean fabrics only.",
  },
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
          <div className={styles.dosDonts}>
            <div>
              <h3 className={`${styles.ddHead} ${styles.teal}`}>
                <Check className="ic" aria-hidden /> Do
              </h3>
              <div className={styles.ddList}>
                {DOS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className={styles.ddItem}>
                    <span className={`${styles.ddIc} ${styles.teal}`}>
                      <Icon className="ic" aria-hidden />
                    </span>
                    <div>
                      <b>{title}</b>
                      <small>{desc}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className={`${styles.ddHead} ${styles.crimson}`}>
                <X className="ic" aria-hidden /> Don&rsquo;t
              </h3>
              <div className={styles.ddList}>
                {DONTS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className={styles.ddItem}>
                    <span className={`${styles.ddIc} ${styles.crimson}`}>
                      <Icon className="ic" aria-hidden />
                    </span>
                    <div>
                      <b>{title}</b>
                      <small>{desc}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`card card-pad ${styles.help}`}>
            <div className={styles.helpCopy}>
              <span className={styles.helpIc}>
                <Heart className="ic" aria-hidden />
              </span>
              <div>
                <h3>Something not right?</h3>
                <p className="muted">
                  Drop us a message any time — we&rsquo;d always rather take a
                  look. All our work comes with free touch-ups within three
                  months.
                </p>
              </div>
            </div>
            <Link href="/enquire" className="btn btn-gold">
              Get in touch <ArrowRight className="ic" aria-hidden />
            </Link>
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
