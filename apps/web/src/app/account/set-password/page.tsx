import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "./SetPasswordForm";

/**
 * Account activation page — the target of the welcome email's set-password
 * link (/account/set-password?token=…). Without a token it renders a friendly
 * pointer back to sign-in instead of the form.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set your password · Boots 'n' Bandit",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <span className="eyebrow">Bandit Pass</span>
          <h1 className="display">Set your password</h1>
          <p className="lead">
            Choose a password to activate your account and open your passport.
          </p>
        </div>
      </header>
      <section className="section">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="card card-pad">
            {token ? (
              <SetPasswordForm token={token} />
            ) : (
              <>
                <p className="muted" style={{ margin: "0 0 14px" }}>
                  This page needs the set-password link from your welcome email
                  — open the newest email from the studio and tap the button
                  there. Already set a password?
                </p>
                <Link href="/account/sign-in" className="btn btn-sm">
                  Go to sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
