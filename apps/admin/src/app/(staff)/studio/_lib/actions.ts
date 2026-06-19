"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { requireRole } from "@bnb/core/auth";
import { inviteStaff } from "./invite";

/**
 * Owner-gated Studio › Staff server actions (K1): invite a new staff member
 * (mint token + send email), change a user's role, enable/disable a user, and
 * remove one of their passkeys.
 */

const STAFF_PATH = "/studio/staff";

function role(fd: FormData): Role {
  return fd.get("role") === "OWNER" ? "OWNER" : "ARTIST";
}

export async function inviteStaffAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const email = String(fd.get("email") ?? "").trim();
  if (!email) throw new Error("Email is required");
  const displayName = String(fd.get("displayName") ?? "").trim() || undefined;
  await inviteStaff({ email, role: role(fd), displayName });
  revalidatePath(STAFF_PATH);
}

export async function setRoleAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await prisma.user.update({ where: { id }, data: { role: role(fd) } });
  revalidatePath(STAFF_PATH);
}

export async function setActiveAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const active = fd.get("active") === "true" || fd.get("active") === "on";
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath(STAFF_PATH);
}

export async function removePasskeyAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const credentialId = String(fd.get("credentialId") ?? "");
  if (!credentialId) throw new Error("Missing credentialId");
  await prisma.authenticator.delete({ where: { id: credentialId } });
  revalidatePath(STAFF_PATH);
}
