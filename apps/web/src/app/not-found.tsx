import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/site";

export const metadata: Metadata = {
  title: "Page not found · Boots 'n' Bandit",
};

/** Branded 404 — keeps the site shell (Ticker/Nav/Footer) and points home. */
export default function NotFound() {
  return (
    <div className="page">
      <section className="section">
        <div className="wrap center" style={{ padding: "64px 0" }}>
          <span
            aria-hidden
            style={{
              width: 64,
              opacity: 0.4,
              margin: "0 auto 16px",
              display: "block",
            }}
          >
            <Mark />
          </span>
          <span className="eyebrow">404</span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Lost the trail
          </h1>
          <p className="lead" style={{ maxWidth: 480, margin: "0 auto 24px" }}>
            That page doesn&rsquo;t exist — maybe it healed over. Head back to
            the studio and we&rsquo;ll point you right.
          </p>
          <div className="hero-cta" style={{ justifyContent: "center", marginTop: 0 }}>
            <Link href="/" className="btn">
              Back home
            </Link>
            <Link href="/enquire" className="btn btn-ghost">
              Make an enquiry
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
