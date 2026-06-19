"use client";

import { KeyRound, UserPlus, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { artistStatusLabel, type ArtistStatus } from "@bnb/core/artist-status";

/**
 * Studio › Staff manager (K1). Invite form (mints + emails an invite) plus a
 * roster with per-user role select, enable/disable toggle and passkey removal.
 * Under artist/user unification every staff member is an artist: the roster
 * surfaces each user's linked Artist profile (title) and flags any account that
 * has no profile yet (create one in Content › Artists). All mutations are
 * server-action form submits owned by `studio/_lib/actions`.
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

export interface StaffManagerProps {
  staff: StaffMember[];
  inviteAction: (fd: FormData) => Promise<void>;
  setRoleAction: (fd: FormData) => Promise<void>;
  setActiveAction: (fd: FormData) => Promise<void>;
  removePasskeyAction: (fd: FormData) => Promise<void>;
}

export function StaffManager({
  staff,
  inviteAction,
  setRoleAction,
  setActiveAction,
  removePasskeyAction,
}: StaffManagerProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-bb-crimson/30 bg-bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <UserPlus className="h-4 w-4" /> Invite staff
        </h2>
        <form
          action={inviteAction}
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
              placeholder="artist@studio.test"
            />
          </div>
          <div>
            <Label htmlFor="invite-name" className="mb-1.5 block">
              Display name
            </Label>
            <Input id="invite-name" name="displayName" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="invite-role" className="mb-1.5 block">
              Role
            </Label>
            <select
              id="invite-role"
              name="role"
              defaultValue="ARTIST"
              className="h-10 rounded-md border border-border-default bg-bg-raised px-3 text-sm text-text-primary"
            >
              <option value="ARTIST">Artist</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
          <Button type="submit" className="gap-1.5">
            Send invite
          </Button>
        </form>
        <p className="mt-2 text-xs text-text-muted">
          Mints a single-use invite link and emails it to the invitee to enrol a
          passkey. Every staff member is an artist — create their public profile
          in Content › Artists (it links to this account 1:1).
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          Roster ({staff.length})
        </h2>
        <ul className="space-y-3">
          {staff.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-border-default bg-bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">
                    {m.displayName}
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
                <div className="flex items-center gap-2">
                  <form
                    action={setRoleAction}
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
                    <Button type="submit" variant="outline" size="sm">
                      Set role
                    </Button>
                  </form>
                  <form action={setActiveAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={(!m.active).toString()}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {m.active ? "Disable" : "Enable"}
                    </Button>
                  </form>
                </div>
              </div>

              <div className="mt-3 border-t border-border-default pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                  <KeyRound className="h-3.5 w-3.5" /> Passkeys (
                  {m.passkeys.length})
                </p>
                {m.passkeys.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    No passkeys enrolled.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {m.passkeys.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-sm text-text-secondary"
                      >
                        <span>{p.deviceName ?? "Device"}</span>
                        <form action={removePasskeyAction}>
                          <input
                            type="hidden"
                            name="credentialId"
                            value={p.id}
                          />
                          <button
                            type="submit"
                            aria-label="Remove passkey"
                            className="grid h-7 w-7 place-items-center rounded-md border border-border-default text-text-muted hover:text-bb-crimson"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
