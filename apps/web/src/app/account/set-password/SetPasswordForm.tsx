"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/site";
import { setPasswordAction, type AccountActionState } from "../actions";

/**
 * Client island for the account-activation card. Posts the setPasswordAction
 * server action; the terminal "expired" / "invalid" outcomes replace the form
 * with the action's message (expired links have already re-emailed a fresh
 * one by the time that state renders).
 */

const initialState: AccountActionState = { error: null };

export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    setPasswordAction,
    initialState,
  );

  if (state.code) {
    return (
      <div role="alert">
        <p className="muted" style={{ margin: "0 0 14px" }}>
          {state.error}
        </p>
        {state.code === "invalid" && (
          <Link href="/account/sign-in" className="btn btn-sm">
            Go to sign in
          </Link>
        )}
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="setpw-password">
        <input
          id="setpw-password"
          className="input"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field
        label="Confirm password"
        htmlFor="setpw-confirm"
        hint="At least 8 characters."
      >
        <input
          id="setpw-confirm"
          className="input"
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      {state.error && (
        <p
          role="alert"
          className="meta"
          style={{ color: "var(--bb-crimson)", margin: "0 0 14px" }}
        >
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-gold" disabled={pending}>
        {pending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
