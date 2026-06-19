"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateToken } from "@/lib/auth/tokens";

/**
 * My Profile server actions (L). Self-scoped: each action resolves the signed-in
 * user and only mutates rows they own (their linked Artist, their CalendarFeed,
 * their own passkeys) — never another user's data.
 */

const PROFILE_PATH = "/admin/profile";

async function requireOwnArtist(): Promise<{
  userId: string;
  artistId: string;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (!user.artistId) throw new Error("No linked artist profile");
  return { userId: user.id, artistId: user.artistId };
}

function str(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

function arr(fd: FormData, key: string): string[] {
  const raw = fd.get(key);
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function ids(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

/** £ string → integer pence, or null for blank/invalid. */
function pence(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export async function saveProfile(fd: FormData): Promise<void> {
  const { artistId } = await requireOwnArtist();
  await prisma.artist.update({
    where: { id: artistId },
    data: {
      bio: str(fd, "bio"),
      insta: str(fd, "insta"),
      headshot: str(fd, "headshot"),
      hourlyRatePence: pence(fd, "hourlyRatePounds"),
      dayRatePence: pence(fd, "dayRatePounds"),
      styles: { set: ids(fd, "styleIds").map((id) => ({ id })) },
      specials: arr(fd, "specials"),
    },
  });
  revalidatePath(PROFILE_PATH);
}

export async function regenerateFeed(_fd?: FormData): Promise<void> {
  void _fd;
  const { artistId } = await requireOwnArtist();
  const token = generateToken();
  await prisma.calendarFeed.upsert({
    where: { artistId },
    create: { artistId, token },
    update: { token },
  });
  revalidatePath(PROFILE_PATH);
}

export async function removeOwnPasskey(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const credentialId = String(fd.get("credentialId") ?? "");
  if (!credentialId) throw new Error("Missing credentialId");
  // Self-scope: only delete a passkey that belongs to the current user.
  const owned = await prisma.authenticator.findFirst({
    where: { id: credentialId, userId: user.id },
  });
  if (!owned) return;
  await prisma.authenticator.delete({ where: { id: credentialId } });
  revalidatePath(PROFILE_PATH);
}
