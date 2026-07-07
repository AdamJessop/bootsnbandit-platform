"use client";

/**
 * "Add a passkey" (My Profile › Passkeys & devices). Enrols another device for
 * the signed-in user via the session-derived registration flow (no invite),
 * then refreshes the server-rendered key list. Errors (including a cancelled
 * ceremony) surface inline.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enrolPasskey, postJSON } from "../_lib/passkey";

export function AddPasskeyButton() {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();

  const supported =
    typeof window === "undefined" ? true : browserSupportsWebAuthn();
  if (!supported) return null;

  function add() {
    setError(null);
    setAdded(false);
    start(async () => {
      const res = await enrolPasskey(
        {
          post: postJSON,
          register: (options) =>
            startRegistration({
              optionsJSON: options as Parameters<
                typeof startRegistration
              >[0]["optionsJSON"],
            }),
        },
        deviceName,
      );
      if (res.ok) {
        setDeviceName("");
        setAdded(true);
        router.refresh();
      } else {
        setError(res.error ?? "Could not add a passkey.");
      }
    });
  }

  return (
    <div className="mt-4 border-t border-border-default pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1.5">
          <Label htmlFor="new-passkey-device">
            Name this device (optional)
          </Label>
          <Input
            id="new-passkey-device"
            type="text"
            autoComplete="off"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="My iPhone"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={add}
          disabled={pending}
        >
          <Plus className="h-4 w-4" />
          {pending ? "Waiting for passkey…" : "Add a passkey"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-bb-crimson" role="alert">
          {error}
        </p>
      ) : null}
      {added ? (
        <p className="mt-2 text-sm text-bb-teal" role="status">
          Passkey added — you can sign in with this device now.
        </p>
      ) : null}
    </div>
  );
}
