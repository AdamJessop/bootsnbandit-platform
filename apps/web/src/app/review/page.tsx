import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "../_data";

/**
 * `/review` with no token. Review requests link to `/review/<token>`, but a
 * link that lost its token (or a request sent before one was minted) lands
 * here — so rather than a 404, explain where the real link lives and how to
 * reach the studio for a fresh one.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leave a review · Boots 'n' Bandit",
  robots: { index: false, follow: false },
};

async function loadContact(): Promise<{ email: string | null }> {
  try {
    const s = await getSiteSettings();
    return { email: s?.email?.trim() || null };
  } catch {
    return { email: null };
  }
}

export default async function ReviewIndexPage() {
  const { email } = await loadContact();
  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <span className="eyebrow">Leave a review</span>
          <h1 className="display">Kind words</h1>
        </div>
      </header>
      <section className="section">
        <div className="wrap wrap-narrow">
          <div className="card card-pad">
            <h2 className="display">Use the link from your email</h2>
            <p className="lead">
              Every review link is personal to your visit, so this page needs
              the full link from the email we sent after your session. Open that
              email and tap the button — it brings you straight to the form.
            </p>
            <p className="muted">
              Can&rsquo;t find it, or the link doesn&rsquo;t work? Get in touch
              and we&rsquo;ll send you a fresh one.
            </p>
            <div
              className="hero-cta"
              style={{ justifyContent: "flex-start", marginTop: 16 }}
            >
              {email && (
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent("Review link")}`}
                  className="btn btn-sm"
                >
                  Email the studio
                </a>
              )}
              <Link
                href="/studio"
                className={email ? "btn btn-sm btn-ghost" : "btn btn-sm"}
              >
                Contact the studio
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
