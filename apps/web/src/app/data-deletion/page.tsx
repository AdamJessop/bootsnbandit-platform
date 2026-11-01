import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { ornDot } from "@/components/site";
import { DELETION_DAYS, POLICY_UPDATED, PRIVACY_EMAIL } from "@/lib/legal";

// Per-request so the CMS-driven shell (Ticker/Footer) matches the other pages.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Data deletion · Boots 'n' Bandit",
  description:
    "How to ask Boots 'n' Bandit to delete your personal data, including Facebook Messenger and Instagram conversations, what we delete and how long it takes.",
  path: "/data-deletion",
});

const mail = `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent("Delete my data")}`;

/**
 * Data deletion instructions — the URL given to Meta under App settings →
 * User data deletion. Static copy; the privacy policy (/privacy) is the full
 * account of what we hold.
 */
export default function DataDeletionPage() {
  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow">
            {ornDot()}
            Your information
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Delete your data
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            You can ask us to delete everything we hold about you, including
            your Messenger and Instagram conversations with us. Here&rsquo;s
            how.
          </p>
          <p className="meta">Last updated: {POLICY_UPDATED}</p>
        </div>
      </header>

      <section className="section">
        <div className="wrap-wide">
          <div className="legal">
            <h2>How to ask</h2>
            <p>Either:</p>
            <ol>
              <li>
                Email <a href={mail}>{PRIVACY_EMAIL}</a> from the address you
                used with us, with &ldquo;Delete my data&rdquo; as the subject;
                or
              </li>
              <li>
                Message our Facebook Page or Instagram account &ldquo;delete my
                data&rdquo; from the account you used to contact us.
              </li>
            </ol>
            <p>
              If you&rsquo;ve contacted us in more than one way, tell us the
              names, email addresses or phone numbers you used so we catch
              everything. If we can&rsquo;t tell the request is really from you,
              we&rsquo;ll ask you to confirm before deleting anything.
            </p>

            <h2>What we delete</h2>
            <ul>
              <li>
                your enquiries, and your mood boards and reference images;
              </li>
              <li>
                your conversations with us by email, Messenger and Instagram,
                including photos and files you sent;
              </li>
              <li>
                the Messenger or Instagram ID, name and username we received
                from Meta;
              </li>
              <li>
                your contact details, Bandit Pass account, stamps, reviews and
                the log of emails we sent you;
              </li>
              <li>
                the conversation in our Page&rsquo;s own Messenger and Instagram
                inbox.
              </li>
            </ul>
            <p>
              We&rsquo;ll do it within <strong>{DELETION_DAYS} days</strong> of
              your request and confirm by email or message when it&rsquo;s done.
            </p>

            <h2>What we have to keep</h2>
            <p>
              If you&rsquo;ve been tattooed with us, the law requires us to keep
              some records for a while after your last appointment:
            </p>
            <ul>
              <li>
                your signed consent form, which our tattooing licence requires;
              </li>
              <li>
                the date, artist, amount paid and bank reference for each
                session, for tax.
              </li>
            </ul>
            <p>
              We keep only those, with nothing else attached, and delete them
              when the period ends (up to 6 years). We also keep a note that we
              received and completed your request, so we can show we did.
            </p>
            <p>
              We can&rsquo;t delete copies outside our systems: the conversation
              in your own Messenger, Instagram or email inbox, or what Meta
              keeps under its own policy. You can delete your side of a
              conversation in the Messenger or Instagram app.
            </p>

            <h2>Removing app access on Facebook</h2>
            <p>
              Messaging us doesn&rsquo;t give our app access to your Facebook
              account. If you&rsquo;ve ever connected an app of ours, you can
              remove it at any time: on Facebook go to{" "}
              <strong>
                Settings &amp; privacy → Settings → Apps and websites
              </strong>
              , choose Boots &rsquo;n&rsquo; Bandit and select{" "}
              <strong>Remove</strong>.
            </p>

            <h2>More about your data</h2>
            <p>
              Our <Link href="/privacy">privacy policy</Link> explains what we
              collect, why, and your other rights, including{" "}
              <Link href="/privacy#data-deletion">
                how we handle Facebook and Instagram messages
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
