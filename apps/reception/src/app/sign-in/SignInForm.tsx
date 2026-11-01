"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

type Status = "idle" | "working" | "error" | "done";

async function postJSON(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Kiosk passkey sign-in. Email-first: enter a staff email → passkey assertion.
 * Passkeys are enrolled on the ADMIN app (invite flow); the kiosk only ever
 * authenticates. A signed-in kiosk stays signed in for 30 days.
 */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const supported =
    typeof window === "undefined" ? true : browserSupportsWebAuthn();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setMessage(null);
    try {
      const optRes = await postJSON("/api/auth/authentication/options", {
        email,
      });
      if (!optRes.ok) throw new Error("Could not start sign-in");
      const options = await optRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await postJSON("/api/auth/authentication/verify", {
        response: assertion,
      });
      if (!verifyRes.ok) throw new Error("That passkey was not recognised");

      setStatus("done");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  if (!supported) {
    return (
      <p className="rk-signin-error" role="alert">
        This browser does not support passkeys. Open the front desk in a modern
        browser to sign in.
      </p>
    );
  }

  return (
    <form onSubmit={handleSignIn} noValidate>
      <div className="field">
        <label htmlFor="email">Your email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="username webauthn"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          style={{ fontSize: 17, padding: 16 }}
        />
      </div>

      <button
        type="submit"
        className="btn btn-lg"
        style={{ width: "100%" }}
        disabled={status === "working" || status === "done"}
      >
        {status === "working" ? "Waiting for passkey…" : "Sign in with passkey"}
      </button>

      {message ? (
        <p className="rk-signin-error" role="alert" style={{ marginTop: 14 }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
