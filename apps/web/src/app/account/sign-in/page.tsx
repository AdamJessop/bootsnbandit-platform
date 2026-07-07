import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

/**
 * Customer sign-in page (Bandit Pass account area). Server shell around the
 * SignInForm client island — the form posts the signInAction server action.
 */

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <span className="eyebrow">Bandit Pass</span>
          <h1 className="display">Sign in</h1>
          <p className="lead">
            Your bookings, loyalty stamps and aftercare — all in one place.
          </p>
        </div>
      </header>
      <section className="section">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="card card-pad">
            <SignInForm />
          </div>
          <p className="meta" style={{ marginTop: 14 }}>
            No password yet? Your welcome email has a set-password link — ask
            the studio to resend it if you can&rsquo;t find it.
          </p>
        </div>
      </section>
    </>
  );
}
