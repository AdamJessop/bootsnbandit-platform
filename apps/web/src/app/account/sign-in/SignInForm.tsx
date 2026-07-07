"use client";

import { useActionState } from "react";
import { Field } from "@/components/site";
import { signInAction, type AccountActionState } from "../actions";

/**
 * Client island for the customer sign-in card. Submits via the signInAction
 * server action; success redirects to /passport server-side, so the only
 * client state is the pending flag and the (generic) error message.
 */

const initialState: AccountActionState = { error: null };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <Field label="Email" htmlFor="signin-email">
        <input
          id="signin-email"
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </Field>
      <Field label="Password" htmlFor="signin-password">
        <input
          id="signin-password"
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
