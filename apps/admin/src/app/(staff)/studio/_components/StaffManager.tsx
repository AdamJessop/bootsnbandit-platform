"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  KeyRound,
  UserPlus,
  Trash2,
  Palette,
  Pencil,
  Copy,
  Check,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { artistStatusLabel, type ArtistStatus } from "@bnb/core/artist-status";
import type { InviteResult, StaffActionResult } from "../_lib/types";

/**
 * Studio › Staff manager (K1). Invite form (mints + emails an invite, then
 * shows the link so the owner can WhatsApp it if the email doesn't land),
 * pending invites with Copy link / Resend, plus a roster with per-user role
 * select, name/email edit, enable/disable and passkey removal. Under
 * artist/user unification every staff member is an artist: the roster
 * surfaces each user's linked Artist profile (title) and flags any account
 * that has no profile yet (create one in Content › Artists).
 *
 * All mutations are server actions owned by `studio/_lib/actions`; each
 * returns a result shown inline next to the control. Disabling an account and
 * removing a passkey are two-step (inline confirm) — the server also refuses
 * anything that would leave the studio without a working owner.
 */

export interface StaffPasskey {
  id: string;
  deviceName: string | null;
  createdAt: string;
}

export interface StaffArtist {
  slug: string;
  status: ArtistStatus;
}

export interface StaffMember {
  id: string;
  email: string;
  displayName: string;
  role: "OWNER" | "ARTIST";
  active: boolean;
  artist: StaffArtist | null;
  passkeys: StaffPasskey[];
}

export interface StaffInviteRow {
  id: string;
  email: string;
  role: "OWNER" | "ARTIST";
  url: string;
  /** ISO timestamp. */
  expiresAt: string;
}

type Action<R> = (fd: FormData) => Promise<R>;

export interface StaffManagerProps {
  staff: StaffMember[];
  invites?: StaffInviteRow[];
  /** The signed-in owner — they can't disable or demote themselves. */
  currentUserId?: string;
  inviteAction: Action<InviteResult>;
  resendInviteAction?: Action<InviteResult>;
  setRoleAction: Action<StaffActionResult>;
  setActiveAction: Action<StaffActionResult>;
  removePasskeyAction: Action<StaffActionResult>;
  updateDetailsAction?: Action<StaffActionResult>;
}

const ROLE_LABEL = { OWNER: "Owner", ARTIST: "Artist" } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const EXPIRY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

/** The roster member an invite email belongs to, if any (case-insensitive). */
export function existingMemberFor(
  email: string,
  staff: StaffMember[],
): StaffMember | null {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  return staff.find((m) => m.email.toLowerCase() === needle) ?? null;
}

/** "7 days" / "1 day" / "less than a day" left on an invite link. */
export function validFor(expiresAt: string, now: number = Date.now()): string {
  const days = Math.round((new Date(expiresAt).getTime() - now) / DAY_MS);
  if (days < 1) return "less than a day";
  return days === 1 ? "1 day" : `${days} days`;
}

/** The confirmation line after an invite is created (or re-sent). */
export function inviteOutcomeMessage(
  result: Extract<InviteResult, { ok: true }>,
  now: number = Date.now(),
): string {
  const valid = validFor(result.expiresAt, now);
  return result.emailed
    ? `Invite emailed to ${result.email} — link valid ${valid}. If it doesn't arrive, copy the link and send it by WhatsApp or text.`
    : `The email to ${result.email} didn't send — copy the link below and send it by WhatsApp or text. Link valid ${valid}.`;
}

/** The submitted form as FormData (React's onSubmit, not a form action). */
function formData(e: FormEvent<HTMLFormElement>): FormData {
  e.preventDefault();
  return new FormData(e.currentTarget);
}

/**
 * Copies an invite link. Falls back to showing the link in a pre-selected
 * field when the Clipboard API is unavailable or refused (non-secure context,
 * older iPad Safari), so the owner can still long-press → Copy.
 */
export function CopyLinkButton({
  url,
  label = "Copy invite link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setManual(true);
      // Next paint: the field exists now.
      setTimeout(() => field.current?.select(), 0);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={copy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : label}
      </Button>
      {manual && (
        <input
          ref={field}
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-border-default bg-bg-raised px-2 font-mono text-xs text-text-primary"
        />
      )}
    </span>
  );
}

export function InviteOutcome({ result }: { result: InviteResult }) {
  if (!result.ok) {
    return (
      <p role="alert" className="mt-3 text-sm text-bb-crimson">
        {result.error}
      </p>
    );
  }
  return (
    <div
      role="status"
      className={`mt-3 space-y-2 rounded-md border p-3 text-sm ${
        result.emailed
          ? "border-bb-teal/40 text-text-secondary"
          : "border-bb-gold/50 text-text-secondary"
      }`}
    >
      <p>{inviteOutcomeMessage(result)}</p>
      <CopyLinkButton url={result.inviteUrl} />
    </div>
  );
}

/**
 * Inline two-step confirm (never `window.confirm`): the first click swaps the
 * button for a short prompt with Confirm / Cancel.
 */
function ConfirmStep({
  label,
  prompt,
  confirmLabel,
  pending,
  onConfirm,
  trigger,
}: {
  label: string;
  prompt: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return trigger ? (
      <>{trigger(() => setOpen(true))}</>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-secondary">{prompt}</span>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          onConfirm();
          setOpen(false);
        }}
      >
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </span>
  );
}

function InviteForm({
  staff,
  inviteAction,
}: {
  staff: StaffMember[];
  inviteAction: Action<InviteResult>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // null = untouched: follow the email (keep an existing member's role).
  const [roleChoice, setRoleChoice] = useState<"" | "ARTIST" | "OWNER" | null>(
    null,
  );
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, start] = useTransition();

  const existing = existingMemberFor(email, staff);
  const roleValue =
    roleChoice === null || (roleChoice === "" && !existing)
      ? existing
        ? ""
        : "ARTIST"
      : roleChoice;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const fd = formData(e);
    start(async () => {
      const res = await inviteAction(fd);
      setResult(res);
      if (res.ok) {
        setEmail("");
        setName("");
        setRoleChoice(null);
      }
    });
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
      >
        <div>
          <Label htmlFor="invite-email" className="mb-1.5 block">
            Email
          </Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div>
          <Label htmlFor="invite-name" className="mb-1.5 block">
            Display name
          </Label>
          <Input
            id="invite-name"
            name="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label htmlFor="invite-role" className="mb-1.5 block">
            Role
          </Label>
          <select
            id="invite-role"
            name="role"
            value={roleValue}
            onChange={(e) =>
              setRoleChoice(e.target.value as "" | "ARTIST" | "OWNER")
            }
            className="h-10 rounded-md border border-border-default bg-bg-raised px-3 text-sm text-text-primary"
          >
            {existing && (
              <option value="">
                Keep current ({ROLE_LABEL[existing.role]})
              </option>
            )}
            <option value="ARTIST">Artist</option>
            <option value="OWNER">Owner</option>
          </select>
        </div>
        <Button type="submit" className="gap-1.5" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </form>
      {existing && (
        <p className="mt-2 text-xs text-text-secondary">
          {existing.displayName} already has an account (
          {ROLE_LABEL[existing.role]}). Sending a new link lets them add a
          device; their role stays the same unless you pick another.
        </p>
      )}
      {result && <InviteOutcome result={result} />}
    </>
  );
}

export function PendingInvites({
  invites,
  resendInviteAction,
}: {
  invites: StaffInviteRow[];
  resendInviteAction?: Action<InviteResult>;
}) {
  const [results, setResults] = useState<Record<string, InviteResult>>({});
  const [pending, start] = useTransition();

  function resend(id: string) {
    if (!resendInviteAction) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await resendInviteAction(fd);
      setResults((r) => ({ ...r, [id]: res }));
    });
  }

  return (
    <section>
      <h2 className="mb-3 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
        Pending invites ({invites.length})
      </h2>
      {invites.length === 0 ? (
        <p className="text-sm text-text-muted">
          No invites waiting to be accepted.
        </p>
      ) : (
        <ul className="space-y-2">
          {invites.map((inv) => {
            const res = results[inv.id];
            return (
              <li
                key={inv.id}
                className="rounded-lg border border-border-default bg-bg-card p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">{inv.email}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                      <Clock className="h-3.5 w-3.5" />
                      {ROLE_LABEL[inv.role]} · expires{" "}
                      {EXPIRY.format(new Date(inv.expiresAt))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyLinkButton url={inv.url} label="Copy link" />
                    {resendInviteAction && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={pending}
                        onClick={() => resend(inv.id)}
                      >
                        <Send className="h-3.5 w-3.5" /> Resend
                      </Button>
                    )}
                  </div>
                </div>
                {res &&
                  (res.ok ? (
                    <p role="status" className="mt-2 text-xs text-text-secondary">
                      {res.emailed
                        ? `Re-sent to ${res.email}.`
                        : `The email didn't send — copy the link and send it by WhatsApp or text.`}
                    </p>
                  ) : (
                    <p role="alert" className="mt-2 text-xs text-bb-crimson">
                      {res.error}
                    </p>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StaffRow({
  m,
  isSelf,
  setRoleAction,
  setActiveAction,
  removePasskeyAction,
  updateDetailsAction,
}: {
  m: StaffMember;
  isSelf: boolean;
  setRoleAction: Action<StaffActionResult>;
  setActiveAction: Action<StaffActionResult>;
  removePasskeyAction: Action<StaffActionResult>;
  updateDetailsAction?: Action<StaffActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function run(
    action: Action<StaffActionResult>,
    fd: FormData,
    onOk?: () => void,
    onFail?: () => void,
  ) {
    start(async () => {
      const res = await action(fd);
      if (res.ok) {
        setError(null);
        onOk?.();
      } else {
        setError(res.error);
        onFail?.();
      }
    });
  }

  function fields(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  return (
    <li className="rounded-lg border border-border-default bg-bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-text-primary">
            {m.displayName}
            {isSelf && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                (you)
              </span>
            )}
            {!m.active && (
              <span className="ml-2 rounded bg-bb-crimson/15 px-1.5 py-0.5 text-[10px] uppercase text-bb-crimson">
                Disabled
              </span>
            )}
          </p>
          <p className="text-sm text-text-muted">{m.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
            <Palette className="h-3.5 w-3.5" />
            {m.artist ? (
              <span>{artistStatusLabel(m.artist.status)}</span>
            ) : (
              <span className="text-bb-gold">
                No artist profile — add one in Content › Artists
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updateDetailsAction && !editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit name &amp; email
            </Button>
          )}
          {m.artist && (
            <Link
              href={`/studio/staff/${m.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-default px-3 text-sm text-text-secondary hover:text-text-primary"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </Link>
          )}
          {isSelf ? (
            <span className="text-xs text-text-muted">
              {ROLE_LABEL[m.role]} — another owner can change your role or
              disable you.
            </span>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  // A refused change snaps the select back to the real role.
                  const form = e.currentTarget;
                  run(setRoleAction, formData(e), undefined, () =>
                    form.reset(),
                  );
                }}
                className="flex items-center gap-1.5"
              >
                <input type="hidden" name="id" value={m.id} />
                <select
                  name="role"
                  defaultValue={m.role}
                  aria-label={`Role for ${m.email}`}
                  className="h-9 rounded-md border border-border-default bg-bg-raised px-2 text-sm text-text-primary"
                >
                  <option value="ARTIST">Artist</option>
                  <option value="OWNER">Owner</option>
                </select>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                >
                  Set role
                </Button>
              </form>
              {m.active ? (
                <ConfirmStep
                  label="Disable"
                  prompt={`Disable ${m.displayName}? They're signed out everywhere.`}
                  confirmLabel="Yes, disable"
                  pending={pending}
                  onConfirm={() =>
                    run(setActiveAction, fields({ id: m.id, active: "false" }))
                  }
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(setActiveAction, fields({ id: m.id, active: "true" }))
                  }
                >
                  Enable
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && updateDetailsAction && (
        <form
          onSubmit={(e) =>
            run(updateDetailsAction, formData(e), () => setEditing(false))
          }
          className="mt-3 grid items-end gap-3 border-t border-border-default pt-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input type="hidden" name="id" value={m.id} />
          <div>
            <Label htmlFor={`name-${m.id}`} className="mb-1.5 block">
              Display name
            </Label>
            <Input
              id={`name-${m.id}`}
              name="displayName"
              required
              defaultValue={m.displayName}
            />
          </div>
          <div>
            <Label htmlFor={`email-${m.id}`} className="mb-1.5 block">
              Email (used to sign in)
            </Label>
            <Input
              id={`email-${m.id}`}
              name="email"
              type="email"
              required
              defaultValue={m.email}
              placeholder="name@example.com"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-bb-crimson">
          {error}
        </p>
      )}

      <div className="mt-3 border-t border-border-default pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
          <KeyRound className="h-3.5 w-3.5" /> Passkeys ({m.passkeys.length})
        </p>
        {m.passkeys.length === 0 ? (
          <p className="text-sm text-text-muted">No passkeys enrolled.</p>
        ) : (
          <ul className="space-y-1.5">
            {m.passkeys.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary"
              >
                <span>{p.deviceName ?? "Device"}</span>
                <ConfirmStep
                  label="Remove passkey"
                  prompt={`Remove ${p.deviceName ?? "this device"}? It can no longer sign in.`}
                  confirmLabel="Yes, remove"
                  pending={pending}
                  onConfirm={() =>
                    run(removePasskeyAction, fields({ credentialId: p.id }))
                  }
                  trigger={(open) => (
                    <button
                      type="button"
                      aria-label="Remove passkey"
                      onClick={open}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border-default text-text-muted hover:text-bb-crimson"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function StaffManager({
  staff,
  invites = [],
  currentUserId,
  inviteAction,
  resendInviteAction,
  setRoleAction,
  setActiveAction,
  removePasskeyAction,
  updateDetailsAction,
}: StaffManagerProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-bb-crimson/30 bg-bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <UserPlus className="h-4 w-4" /> Invite staff
        </h2>
        <InviteForm staff={staff} inviteAction={inviteAction} />
        <p className="mt-2 text-xs text-text-muted">
          Mints a single-use invite link (valid 7 days) and emails it to the
          invitee to enrol a passkey. Use their personal email — mail to the
          studio&rsquo;s own domain lands in the enquiry inbox. Every staff
          member is an artist — create their public profile in Content ›
          Artists (it links to this account 1:1).
        </p>
      </section>

      <PendingInvites
        invites={invites}
        resendInviteAction={resendInviteAction}
      />

      <section>
        <h2 className="mb-3 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          Roster ({staff.length})
        </h2>
        <ul className="space-y-3">
          {staff.map((m) => (
            <StaffRow
              key={m.id}
              m={m}
              isSelf={m.id === currentUserId}
              setRoleAction={setRoleAction}
              setActiveAction={setActiveAction}
              removePasskeyAction={removePasskeyAction}
              updateDetailsAction={updateDetailsAction}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
