"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { requireRole } from "@bnb/core/auth";
import { coerceArtist, slugify } from "./artist-form";

/**
 * Unified Artist CMS server actions (Content › Artists, owner-gated).
 *
 * `createArtist` creates BOTH a `User` (auth: email + access role OWNER|ARTIST)
 * and the linked `Artist` profile in a single `prisma.$transaction` so the 1:1
 * pair is atomic — an error leaves no orphan on either side. `updateArtist`
 * edits the profile, re-setting the style relation by id, the status enum and
 * the numeric £ rates (stored as pence).
 */

const ARTISTS_PATH = "/content/artists";

export async function createArtist(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const { profile, styleIds, email, accessRole } = coerceArtist(fd);
  if (!email) throw new Error("Email is required to create the staff account");
  const slug = profile.slug || slugify(profile.name);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        role: accessRole,
        displayName: profile.name,
      },
    });
    await tx.artist.create({
      data: {
        ...profile,
        slug,
        user: { connect: { id: user.id } },
        styles: { connect: styleIds.map((id) => ({ id })) },
      },
    });
  });

  revalidatePath(ARTISTS_PATH);
}

export async function updateArtist(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const { profile, styleIds } = coerceArtist(fd);
  const slug = profile.slug || slugify(profile.name);

  await prisma.artist.update({
    where: { id },
    data: {
      ...profile,
      slug,
      styles: { set: styleIds.map((styleId) => ({ id: styleId })) },
    },
  });

  revalidatePath(ARTISTS_PATH);
}

// Not exported: a "use server" module may only export async functions.
const ARTIST_HAS_CONSENT_FORMS =
  "This artist has signed consent forms on file, so they can't be deleted — untick Active to take them off the site instead.";

/**
 * Deleting an artist cascades to their bookings, and a booking with a signed
 * consent form is protected (`ConsentForm` → `Booking` is onDelete: Restrict:
 * it is a licensing record). Rather than let that surface as a crash, refuse
 * up front with a message the editor shows inline; the P2003 catch covers a
 * form signed between the check and the delete.
 */
export async function deleteArtist(
  fd: FormData,
): Promise<void | { error: string }> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const signedForms = await prisma.consentForm.count({
    where: { booking: { artistId: id } },
  });
  if (signedForms > 0) return { error: ARTIST_HAS_CONSENT_FORMS };
  try {
    await prisma.artist.delete({ where: { id } });
  } catch (err) {
    if ((err as { code?: unknown })?.code === "P2003") {
      return { error: ARTIST_HAS_CONSENT_FORMS };
    }
    throw err;
  }
  revalidatePath(ARTISTS_PATH);
}
