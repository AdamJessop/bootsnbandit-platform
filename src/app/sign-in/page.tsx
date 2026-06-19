import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Mark } from "@/components/site/Mark";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Staff sign-in — Boots 'n' Bandit",
};

/**
 * Top-level staff sign-in. Deliberately OUTSIDE the (admin) AppShell — no nav,
 * no sidebar. Email + passkey for returning staff; `?invite=<token>` switches
 * to first-device enrolment.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const existing = await getCurrentUser();
  if (existing) {
    redirect("/admin");
  }

  const { invite } = await searchParams;

  return (
    <main className="bg-bg-default flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="border-border-default bg-bg-card w-full max-w-sm rounded-xl border p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Mark className="text-bb-crimson mb-4 h-12 w-12" />
          <p className="kicker mb-1">Back of house</p>
          <h1 className="display text-text-primary text-2xl">
            Boots &rsquo;n&rsquo; Bandit
          </h1>
          <p className="text-text-muted mt-2 text-sm">
            {invite
              ? "Set up your studio account"
              : "Sign in with your passkey"}
          </p>
        </div>

        <SignInForm invite={invite} />
      </div>
    </main>
  );
}
