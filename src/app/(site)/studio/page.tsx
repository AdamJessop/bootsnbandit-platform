import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Heart,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";
import { ornDot, SectionHead, Plate, Field } from "@/components/site";
import { artistStatusLabel } from "@/lib/artist-status";
import { getSiteSettings, getArtists } from "../_data";
import styles from "./studio.module.css";

export const metadata: Metadata = {
  title: "The Studio · Boots 'n' Bandit",
  description:
    "Boots 'n' Bandit — a fully-licensed heritage tattoo studio on Newcastle Avenue, Worksop. Meet the founders, our values, and how to find us.",
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Spotless & licensed",
    desc: "Single-use needles, hospital-grade sterilisation and a council licence we're proud of.",
  },
  {
    icon: Heart,
    title: "No daft questions",
    desc: "Nervous? First tattoo? We've heard it all and we'll talk you through every step.",
  },
  {
    icon: Sparkles,
    title: "Always custom",
    desc: "Your idea, drawn for you. We never copy another person's tattoo.",
  },
  {
    icon: Star,
    title: "Free touch-ups",
    desc: "Every piece comes with a free touch-up within three months.",
  },
];

export default async function StudioPage() {
  const [settings, artists] = await Promise.all([
    getSiteSettings(),
    getArtists(),
  ]);

  const founders = artists.filter((a) => a.status === "CO_OWNER");
  const address = [
    settings?.addressLine,
    settings?.city,
    settings?.county,
    settings?.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const mapQuery = encodeURIComponent(
    address || "67 Newcastle Avenue, Worksop, S80 1LX",
  );
  const mapSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow">
            {ornDot()}
            Est. 2016 · Worksop
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            The studio
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            A heritage tattoo shop built on proper custom work, a spotless room
            and a warm welcome.
          </p>
        </div>
      </header>

      {/* ABOUT */}
      <section className="section">
        <div className="wrap-wide">
          <div className={styles.about}>
            <div className={styles.aboutCopy}>
              <SectionHead eyebrow="Our story" title="Two friends, two machines" />
              <p>
                We started Boots &rsquo;n&rsquo; Bandit in 2016 above a barber&rsquo;s
                with two machines and a lot of nerve. Word spread, the diary
                filled, and we grew into the shop you see today — seven artists
                on Newcastle Avenue, still chasing that same feeling of someone
                walking out delighted with something they&rsquo;ll wear forever.
              </p>
            </div>
            <Plate seed="studio-about" ratio="4/3" />
          </div>
        </div>
      </section>

      {/* FOUNDERS */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap-wide">
          <SectionHead eyebrow="The owners" title="Who started it" />
          <div className={styles.founders}>
            {founders.map((f) => (
              <div key={f.slug} className={`card card-pad ${styles.founder}`}>
                <Plate
                  seed={`artist-${f.slug}`}
                  src={f.headshot ?? undefined}
                  face
                  ratio="1/1"
                  className={styles.founderPlate}
                />
                <div>
                  <h3 className="chrome">{f.name}</h3>
                  <span className="meta">{artistStatusLabel(f.status)}</span>
                  {f.bio && <p>{f.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section">
        <div className="wrap-wide">
          <SectionHead eyebrow="What we stand for" title="Our values" />
          <div className={styles.values}>
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className={`card card-pad ${styles.valueCard}`}>
                  <Icon className="ic" />
                  <h3>{v.title}</h3>
                  <p>{v.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* VISIT + MAP */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap-wide">
          <SectionHead eyebrow="Come and see us" title="Visit the studio" />
          <div className={styles.visit}>
            <div className={`card card-pad ${styles.visitDetails}`}>
              <div className={styles.visitRow}>
                <MapPin className="ic" />
                <span>
                  <b>Address</b>
                  {address || "67 Newcastle Avenue, Worksop, S80 1LX"}
                </span>
              </div>
              <div className={styles.visitRow}>
                <Clock className="ic" />
                <span>
                  <b>Opening hours</b>
                  {settings?.hoursText ?? "Tue–Sat 10am–6pm · Closed Sun & Mon"}
                </span>
              </div>
              {settings?.phone && (
                <div className={styles.visitRow}>
                  <Phone className="ic" />
                  <span>
                    <b>Phone</b>
                    <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>
                      {settings.phone}
                    </a>
                  </span>
                </div>
              )}
              {settings?.licensingText && (
                <div className={styles.visitRow}>
                  <ShieldCheck className="ic" />
                  <span>
                    <b>Licensing</b>
                    {settings.licensingText}
                  </span>
                </div>
              )}
              {settings?.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-ghost"
                  style={{ alignSelf: "flex-start" }}
                >
                  Find us on Facebook
                </a>
              )}
            </div>
            <iframe
              className={styles.mapFrame}
              src={mapSrc}
              title="Map to Boots 'n' Bandit"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="section">
        <div className="wrap-wide">
          <div className={styles.contactGrid}>
            <div>
              <SectionHead eyebrow="Say hello" title="Get in touch" />
              <form>
                <Field label="Your name">
                  <input className="input" name="name" autoComplete="name" />
                </Field>
                <Field label="Email or phone">
                  <input className="input" name="contact" />
                </Field>
                <Field label="Message">
                  <textarea className="textarea" name="message" />
                </Field>
                <Link href="/enquire" className="btn">
                  Send message
                </Link>
              </form>
            </div>
            <div className="card card-pad">
              <p className="muted" style={{ margin: 0 }}>
                Ready to book something in? An enquiry is the quickest way to get
                a free 15-minute consultation with the right artist.
              </p>
              <Link href="/enquire" className="btn btn-sm" style={{ marginTop: 16 }}>
                Make an enquiry
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* GIFT VOUCHERS */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap-wide">
          <div className={styles.voucherBand}>
            <Ticket className="ic gold" style={{ width: 32, height: 32 }} />
            <h2 className="display chrome" style={{ margin: "10px 0" }}>
              Gift vouchers
            </h2>
            <p className="muted" style={{ maxWidth: 480, margin: "0 auto 18px" }}>
              Any amount, never expires. The perfect present for the person
              who&rsquo;s &ldquo;always wanted one&rdquo;.
            </p>
            <Link href="/enquire" className="btn btn-gold">
              Enquire about a voucher
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
