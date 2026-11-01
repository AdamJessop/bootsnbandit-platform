"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { requireRole } from "@bnb/core/auth";
import { findPendingInvite } from "@bnb/core/auth/invite";
import {
  MAX_STAFF_NAME_CHARS,
  normaliseStaffEmail,
  staffEmailProblem,
} from "@bnb/core/auth/staff-email";
import { inviteStaff, sendInviteEmail } from "./invite";
import type { InviteResult, StaffActionResult } from "./types";

/**
 * Owner-gated Studio › Staff server actions (K1): invite a new staff member
 * (mint token + send email) or re-send a pending invite, change a user's role,
 * name or email, enable/disable a user, and remove one of their passkeys.
 *
 * Every action returns a result the StaffManager shows inline rather than
 * throwing. The roster mutations carry lockout guards: the studio must always
 * keep at least one active owner who can still sign in, and an owner can't
 * disable or demote themselves (another owner has to).
 */

const STAFF_PATH = "/studio/staff";

const LAST_OWNER =
  "This is the last active owner — make someone else an owner first.";

/** Explicit role from the form, or undefined for "keep current". */
function pickedRole(fd: FormData): Role | undefined {
  const v = fd.get("role");
  return v === "OWNER" || v === "ARTIST" ? v : undefined;
}

function role(fd: FormData): Role {
  return fd.get("role") === "OWNER" ? "OWNER" : "ARTIST";
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function activeOwnerCount(): Promise<number> {
  return prisma.user.count({ where: { role: "OWNER", active: true } });
}

export async function inviteStaffAction(fd: FormData): Promise<InviteResult> {
  await requireRole("OWNER");
  const email = normaliseStaffEmail(String(fd.get("email") ?? ""));
  const problem = staffEmailProblem(email);
  if (problem) return { ok: false, emailed: false, error: problem };
  const displayName = String(fd.get("displayName") ?? "").trim() || undefined;
  try {
    const invite = await inviteStaff({
      email,
      role: pickedRole(fd),
      displayName,
    });
    revalidatePath(STAFF_PATH);
    return {
      ok: true,
      email: invite.email,
      inviteUrl: invite.url,
      expiresAt: invite.expiresAt.toISOString(),
      emailed: invite.emailed,
    };
  } catch (err) {
    console.error("[staff] invite failed:", err);
    return {
      ok: false,
      emailed: false,
      error: "Couldn't create the invite — try again.",
    };
  }
}

export async function resendInviteAction(fd: FormData): Promise<InviteResult> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  const invite = id ? await findPendingInvite(id) : null;
  if (!invite) {
    return {
      ok: false,
      emailed: false,
      error: "That invite has expired or been used — send a new one.",
    };
  }
  const user = invite.userId
    ? await prisma.user.findUnique({
        where: { id: invite.userId },
        select: { displayName: true },
      })
    : null;
  const emailed = await sendInviteEmail({
    email: invite.email,
    url: invite.url,
    role: invite.role,
    expiresAt: invite.expiresAt,
    inviteeName: user?.displayName,
  });
  return {
    ok: true,
    email: invite.email,
    inviteUrl: invite.url,
    expiresAt: invite.expiresAt.toISOString(),
    emailed,
  };
}

export async function setRoleAction(fd: FormData): Promise<StaffActionResult> {
  const me = await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) return fail("Missing id");
  const next = role(fd);
  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true, active: true },
  });
  if (!target) return fail("That account no longer exists.");
  if (next === "ARTIST" && target.role === "OWNER") {
    if (id === me.id) {
      return fail(
        "You can't remove your own owner role — ask another owner to do it.",
      );
    }
    if (target.active && (await activeOwnerCount()) <= 1) {
      return fail(LAST_OWNER);
    }
  }
  await prisma.user.update({ where: { id }, data: { role: next } });
  revalidatePath(STAFF_PATH);
  return { ok: true };
}

export async function setActiveAction(fd: FormData): Promise<StaffActionResult> {
  const me = await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) return fail("Missing id");
  const active = fd.get("active") === "true" || fd.get("active") === "on";
  if (!active) {
    if (id === me.id) {
      return fail(
        "You can't disable your own account — ask another owner to do it.",
      );
    }
    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true, active: true },
    });
    if (!target) return fail("That account no longer exists.");
    if (
      target.role === "OWNER" &&
      target.active &&
      (await activeOwnerCount()) <= 1
    ) {
      return fail(LAST_OWNER);
    }
  }
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath(STAFF_PATH);
  return { ok: true };
}

export async function removePasskeyAction(
  fd: FormData,
): Promise<StaffActionResult> {
  const me = await requireRole("OWNER");
  const credentialId = String(fd.get("credentialId") ?? "");
  if (!credentialId) return fail("Missing credentialId");
  const passkey = await prisma.authenticator.findUnique({
    where: { id: credentialId },
    select: { userId: true, user: { select: { role: true, active: true } } },
  });
  if (!passkey) return fail("That passkey has already been removed.");
  const remaining = await prisma.authenticator.count({
    where: { userId: passkey.userId },
  });
  if (remaining <= 1) {
    const { role: ownerRole, active } = passkey.user;
    if (
      ownerRole === "OWNER" &&
      active &&
      (await activeOwnerCount()) <= 1
    ) {
      return fail(
        "That's the last owner's only passkey — removing it would lock everyone out of Studio settings. Add another device first.",
      );
    }
    if (passkey.userId === me.id) {
      return fail(
        "That's your only passkey — add another device on My Profile before removing it.",
      );
    }
  }
  await prisma.authenticator.delete({ where: { id: credentialId } });
  revalidatePath(STAFF_PATH);
  return { ok: true };
}

/**
 * Correct a staff member's email and display name (e.g. an account created
 * with a placeholder address). The email is what they sign in with and where
 * invites go, so it gets the same rules as an invite plus uniqueness. Pending
 * invites follow the user to the new address so the roster stays coherent.
 * (Artist profiles carry no email of their own — nothing to sync there.)
 */
export async function updateStaffDetailsAction(
  fd: FormData,
): Promise<StaffActionResult> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) return fail("Missing id");
  const email = normaliseStaffEmail(String(fd.get("email") ?? ""));
  const displayName = String(fd.get("displayName") ?? "").trim();
  if (!displayName) return fail("Display name is required.");
  if (displayName.length > MAX_STAFF_NAME_CHARS) {
    return fail(
      `Keep the display name under ${MAX_STAFF_NAME_CHARS} characters.`,
    );
  }
  const problem = staffEmailProblem(email);
  if (problem) return fail(problem);

  const clash = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return fail("Another account already uses that email.");
  }

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { email, displayName } }),
      prisma.staffInvite.updateMany({
        where: { userId: id, redeemedAt: null },
        data: { email },
      }),
    ]);
  } catch (err) {
    // A concurrent edit can still hit the unique index between our check
    // and the write.
    if ((err as { code?: string }).code === "P2002") {
      return fail("Another account already uses that email.");
    }
    throw err;
  }
  revalidatePath(STAFF_PATH);
  return { ok: true };
}
