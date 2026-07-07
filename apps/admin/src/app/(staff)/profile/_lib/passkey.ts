/**
 * Session-derived passkey enrolment flow ("Add a passkey" on My Profile):
 * POST /api/auth/registration/options (no invite — the API resolves the
 * signed-in user) → authenticator ceremony → POST /api/auth/registration/verify.
 * Deps (fetch + @simplewebauthn/browser startRegistration) are injected so the
 * flow unit-tests in node.
 */

export interface EnrolPasskeyDeps {
  /** POST `body` as JSON to `url`. */
  post: (url: string, body: unknown) => Promise<Response>;
  /** Runs the WebAuthn ceremony for the returned creation options. */
  register: (options: unknown) => Promise<unknown>;
}

export interface EnrolPasskeyResult {
  ok: boolean;
  error?: string;
}

export async function enrolPasskey(
  deps: EnrolPasskeyDeps,
  deviceName?: string,
): Promise<EnrolPasskeyResult> {
  try {
    const optRes = await deps.post("/api/auth/registration/options", {});
    if (!optRes.ok) {
      return {
        ok: false,
        error:
          optRes.status === 401
            ? "Your session has expired — sign in again to add a passkey."
            : "Could not start passkey enrolment.",
      };
    }
    const options: unknown = await optRes.json();

    const attestation = await deps.register(options);

    const trimmed = deviceName?.trim();
    const verifyRes = await deps.post("/api/auth/registration/verify", {
      response: attestation,
      deviceName: trimmed ? trimmed : undefined,
    });
    if (!verifyRes.ok) {
      return { ok: false, error: "Could not register this passkey." };
    }
    return { ok: true };
  } catch (err) {
    // Includes the user cancelling the ceremony (NotAllowedError/AbortError).
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Passkey enrolment failed.",
    };
  }
}

/** Fetch-backed `post` dep (browser). */
export function postJSON(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
