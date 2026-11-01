import type { Metadata } from "next";
import Link from "next/link";
import { ornDot } from "@/components/site";
import { DELETION_DAYS, POLICY_UPDATED, PRIVACY_EMAIL } from "@/lib/legal";

// The copy is static, but the shell (Ticker/Footer) reads CMS SiteSettings;
// rendering per request keeps it in step with every other page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy policy · Boots 'n' Bandit",
  description:
    "What personal information Boots 'n' Bandit collects through enquiries, email, Messenger and Instagram, why, who helps us process it, how long we keep it and your rights.",
};

const mail = `mailto:${PRIVACY_EMAIL}`;

/**
 * Privacy policy (UK GDPR). Static copy — every claim here describes what the
 * codebase actually does (forms, inbox channels, kiosk consent forms, cron
 * retention, cookies), so update it when those change. `#data-deletion` is
 * linked from the /data-deletion page and Meta's app settings.
 */
export default function PrivacyPage() {
  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow">
            {ornDot()}
            Your information
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Privacy policy
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            What we collect when you get in touch or get tattooed with us, why
            we need it, and how to have it changed or deleted. No small print.
          </p>
          <p className="meta">Last updated: {POLICY_UPDATED}</p>
        </div>
      </header>

      <section className="section">
        <div className="wrap-wide">
          <div className="legal">
            <h2>Who we are</h2>
            <p>
              Boots &rsquo;n&rsquo; Bandit is a tattoo studio in Worksop,
              Nottinghamshire. We decide how your personal information is used,
              which makes us its &ldquo;controller&rdquo; under UK data
              protection law. For anything in this policy, email{" "}
              <a href={mail}>{PRIVACY_EMAIL}</a>.
            </p>

            <h2>What we collect</h2>
            <h3>When you enquire</h3>
            <p>
              Through the enquiry form, the Inkling mood-board builder, a flash
              claim or the studio contact form: your name, email address and
              phone number; your tattoo idea, style, placement and size; your
              budget; the artist you&rsquo;d like; your Inkling style-match
              answers; the reference images you upload or pick for your mood
              board; and whether you&rsquo;d like to hear about offers and
              perks.
            </p>
            <h3>When you message us</h3>
            <p>
              Messages you send us, and our replies, by email, Facebook
              Messenger or Instagram Direct, including any photos or files you
              attach. For email we keep your address and the name your mail
              shows. For Messenger and Instagram, see{" "}
              <a href="#data-deletion">Facebook and Instagram</a> below.
            </p>
            <h3>When you book and get tattooed</h3>
            <ul>
              <li>
                Appointment details: date and time, artist, consult or session,
                style, placement, price estimate, deposit and notes; your date
                of birth if you give it when booking; when you checked in.
              </li>
              <li>
                Consent form: at the studio you answer yes/no questions on the
                tablet (that you&rsquo;re 18 or over, sober, not pregnant or
                breastfeeding, have no medical condition affecting healing, and
                so on) and sign it. Some answers are{" "}
                <strong>health information</strong>, which the law treats as
                extra sensitive.
              </li>
              <li>
                Payment records: the amount you paid, any tip and the bank
                transfer reference. We don&rsquo;t take card payments and never
                see your card or bank login.
              </li>
              <li>
                A log of the emails we send you: confirmations, reminders,
                receipts, aftercare guidance, review requests and loyalty perks.
              </li>
            </ul>
            <h3>Bandit Pass and reviews</h3>
            <p>
              If you set up a Bandit Pass account, your email and a scrambled
              (hashed) version of your password, which we can&rsquo;t read, plus
              your stamps and perks. If you leave a review, your star rating and
              words; we may publish a review on this site with your name after a
              member of staff has approved it.
            </p>
            <h3>Technical information</h3>
            <p>
              Our server keeps routine logs (such as IP address, time, page
              requested and errors) to keep the site running and secure. Your IP
              address is also used briefly to stop people flooding our forms.
            </p>

            <h2>Cookies and tracking</h2>
            <p>
              We set <strong>one cookie</strong>, and only when you sign in to
              your Bandit Pass: <code>bb_customer_session</code>, which keeps
              you signed in for up to 30 days and is removed when you sign out.
              It&rsquo;s strictly necessary, so we don&rsquo;t ask first. We use
              no analytics, advertising or tracking cookies, and no Facebook
              Pixel.
            </p>
            <p>
              Two features load content from other companies straight into your
              browser, which means they receive your IP address: the map on our
              Studio page comes from Google Maps (Google may set its own
              cookies), and the image search results in the mood-board builder
              load from Brave and from the websites hosting those images.
            </p>

            <h2>Why we use it</h2>
            <p>The law asks us to name a lawful basis for each use:</p>
            <ul>
              <li>
                <strong>Contract</strong>, including steps you ask for before
                one: replying to your enquiry, booking and changing
                appointments, reminders, receipts and aftercare guidance.
              </li>
              <li>
                <strong>Legal obligation</strong>: keeping consent forms our
                tattooing licence requires, and financial records for tax.
              </li>
              <li>
                <strong>Explicit consent</strong>: the health answers on your
                consent form, given when you sign it. We may also keep them to
                deal with any legal claim.
              </li>
              <li>
                <strong>Legitimate interests</strong>: keeping all your messages
                on one thread whichever channel you use, asking for a review
                after your session, keeping the site and inbox secure, and
                preventing abuse. You can object to any of these.
              </li>
              <li>
                <strong>Consent</strong>: emails about offers and Bandit Pass
                perks, only if you ticked the box. Withdraw it any time by
                emailing us.
              </li>
            </ul>

            <h2>Who else handles it</h2>
            <p>
              We don&rsquo;t sell your information or use it for advertising.
              These services process it for us, only to run the studio:
            </p>
            <ul>
              <li>
                <strong>Hetzner</strong>: our own server in Germany (EU), which
                runs this site, the staff app and the database.
              </li>
              <li>
                <strong>Resend</strong>: sends our emails and receives your
                replies, using its EU region.
              </li>
              <li>
                <strong>Meta Platforms</strong>: carries your messages when you
                contact us on Messenger or Instagram. Meta also handles them
                under its own privacy policy.
              </li>
              <li>
                <strong>Brave Search</strong>: when you search for images in the
                mood-board builder, our server sends Brave the search words
                built from your idea and chosen styles. Not your name, contact
                details or IP address.
              </li>
            </ul>
            <p>
              Artists can view their upcoming appointments in their own calendar
              app through a private feed showing only the appointment type,
              time, status, placement and your first name.
            </p>
            <p>
              We share information with others only when the law requires it,
              for example with our licensing authority or the police.
            </p>
            <p>
              Resend, Meta and Brave are US companies, so some information may
              be handled outside the UK. Where that happens it is protected by
              UK adequacy regulations or the UK&rsquo;s approved data transfer
              agreements.
            </p>

            <h2>How long we keep it</h2>
            <ul>
              <li>
                Mood-board images you upload but never send: deleted
                automatically after 24 hours.
              </li>
              <li>
                Enquiries that don&rsquo;t lead to a booking, and their
                messages: up to 2 years after we last heard from you.
              </li>
              <li>
                Your customer record, bookings, consent forms and payment
                records: up to 6 years after your last appointment, to meet our
                tax and licensing duties and deal with any claim.
              </li>
              <li>
                Messages our system failed to process the first time: deleted
                automatically after 90 days.
              </li>
              <li>
                Server logs: a short period, for security and fixing faults.
              </li>
            </ul>

            <h2>Your rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>get a copy of the information we hold about you (access);</li>
              <li>have anything wrong corrected (rectification);</li>
              <li>have it deleted (erasure);</li>
              <li>ask us to limit how we use it (restriction);</li>
              <li>
                object to us using it on the basis of legitimate interests;
              </li>
              <li>
                receive what you gave us in a format you can take elsewhere
                (portability);
              </li>
              <li>withdraw consent at any time, where we rely on it.</li>
            </ul>
            <p>
              Email <a href={mail}>{PRIVACY_EMAIL}</a>. We&rsquo;ll reply within
              one month and it&rsquo;s free. If you&rsquo;re unhappy with how
              we&rsquo;ve handled your information, you can complain to the
              Information Commissioner&rsquo;s Office at{" "}
              <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a> or
              on 0303 123 1113, though we&rsquo;d appreciate the chance to put
              it right first.
            </p>

            <h2 id="data-deletion">
              Facebook and Instagram messages, and deleting your data
            </h2>
            <p>
              When you message our Facebook Page or Instagram account, Meta
              passes the message to our studio inbox so our artists can reply.
              From Meta we receive:
            </p>
            <ul>
              <li>
                the ID Meta gives you for our Page (a page-scoped ID) or our
                Instagram account (an Instagram-scoped ID);
              </li>
              <li>
                your name as shown on your profile, and on Instagram your
                username;
              </li>
              <li>your messages, and the photos, videos or files you send.</li>
            </ul>
            <p>
              We don&rsquo;t get your email address, phone number, friends,
              posts or anything else from your account, and you never sign in to
              anything of ours with Facebook. We use what we receive only to
              reply to you and keep your enquiry history in one place. Meta only
              lets us reply within 24 hours of your last message; after that we
              may email you instead if you&rsquo;ve given us your address.
            </p>
            <p>
              To have your Messenger or Instagram conversation and everything
              else we hold deleted, email <a href={mail}>{PRIVACY_EMAIL}</a> or
              message us &ldquo;delete my data&rdquo;. We&rsquo;ll do it within{" "}
              {DELETION_DAYS} days. Full instructions are on our{" "}
              <Link href="/data-deletion">data deletion page</Link>.
            </p>

            <h2>Under 18s</h2>
            <p>
              It&rsquo;s illegal to tattoo anyone under 18 in the UK, so we
              don&rsquo;t book them and this site isn&rsquo;t aimed at children.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              If we change how we use your information we&rsquo;ll update this
              page and the date at the top.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
