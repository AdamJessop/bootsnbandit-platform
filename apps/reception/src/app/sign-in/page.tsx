import { redirect } from "next/navigation";
import { getCurrentUser } from "@bnb/core/auth";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Boots 'n' Bandit Front Desk",
};

/**
 * Kiosk sign-in. A member of staff signs the studio tablet in once with their
 * passkey (enrolled on the admin app); the kiosk then stays signed in and the
 * customer-facing flows never see this screen.
 */
export default async function SignInPage() {
  const existing = await getCurrentUser();
  if (existing) {
    redirect("/");
  }

  return (
    <main className="rk-signin">
      <div className="rk-signin-card">
        <div className="rk-signin-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bb-logo.png" alt="" />
          <p className="kicker">Front desk</p>
          <h1>Boots &rsquo;n&rsquo; Bandit</h1>
          <p className="meta">
            Sign this tablet in with your staff passkey to open the kiosk.
          </p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
