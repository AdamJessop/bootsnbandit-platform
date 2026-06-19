"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "enrol";
type Status = "idle" | "working" | "error" | "done";

async function postJSON(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Passkey sign-in + enrolment. Email-first: enter email -> passkey assertion.
 * When an `invite` token is present we switch to enrolment (register a first
 * passkey for the invited staff user). Both flows land the user at / (admin root).
 */
export function SignInForm({ invite }: { invite?: string }) {
  const router = useRouter();
  const mode: Mode = invite ? "enrol" : "signin";
  const [email, setEmail] = useState("");
  const [deviceName, setDeviceName] = useState("");
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

  async function handleEnrol(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setMessage(null);
    try {
      const optRes = await postJSON("/api/auth/registration/options", {
        invite,
      });
      if (!optRes.ok) throw new Error("This invite is invalid or expired");
      const options = await optRes.json();

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await postJSON("/api/auth/registration/verify", {
        response: attestation,
        deviceName: deviceName || undefined,
        invite,
      });
      if (!verifyRes.ok) throw new Error("Could not register this passkey");

      setStatus("done");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Enrolment failed");
    }
  }

  if (!supported) {
    return (
      <p className="text-text-muted text-sm" role="alert">
        This browser does not support passkeys. Open Boots &rsquo;n&rsquo;
        Bandit in a modern browser to sign in.
      </p>
    );
  }

  return (
    <form
      onSubmit={mode === "enrol" ? handleEnrol : handleSignIn}
      className="space-y-5"
      noValidate
    >
      {mode === "signin" ? (
        <div className="space-y-2">
          <Label htmlFor="email">Studio email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username webauthn"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@bootsnbandit.studio"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="device">Name this device (optional)</Label>
          <Input
            id="device"
            name="device"
            type="text"
            autoComplete="off"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="My iPhone"
          />
          <p className="text-text-muted text-xs">
            You&rsquo;ve been invited. Create a passkey to finish setting up
            your account.
          </p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={status === "working" || status === "done"}
      >
        {status === "working"
          ? "Waiting for passkey…"
          : mode === "enrol"
            ? "Create passkey"
            : "Sign in with passkey"}
      </Button>

      {message ? (
        <p className="text-bb-crimson text-sm" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
