/**
 * Result shapes returned by the Studio › Staff server actions to the
 * StaffManager client island. Kept in their own module (not `actions.ts`, a
 * "use server" file, nor the server-only invite orchestration) so both sides
 * can import them.
 */

/** Outcome of a roster mutation; `error` is an owner-facing sentence. */
export type StaffActionResult = { ok: true } | { ok: false; error: string };

/**
 * Outcome of minting (or re-sending) an invite. `emailed` is false when the
 * email didn't go out (Resend error, or no API key) — the link still works and
 * the owner copies it into WhatsApp instead.
 */
export type InviteResult =
  | {
      ok: true;
      email: string;
      inviteUrl: string;
      /** ISO timestamp. */
      expiresAt: string;
      emailed: boolean;
    }
  | { ok: false; emailed: false; error: string };
