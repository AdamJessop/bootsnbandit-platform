"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { requireRole } from "@bnb/core/auth";
import {
  fail,
  knownDbError,
  OK,
  uniqueViolationFields,
  violates,
  type ActionResult,
} from "../../_lib/db-errors";
import { artistInputError, coerceArtist, slugify } from "./artist-form";

/**
 * Unified Artist CMS server actions (Content › Artists, owner-gated).
 *
 * `createArtist` creates BOTH a `User` (auth: email + access role OWNER|ARTIST)
 * and the linked `Artist` profile in a single `prisma.$transaction` so the 1:1
 * pair is atomic — an error leaves no orphan on either side. `updateArtist`
 * edits the profile, re-setting the style relation by id, the status enum and
 * the numeric £ rates (stored as pence).
 *
 * Validation failures and duplicate email/slug come back as
 * `{ ok: false, error }` for the editor to show beside Save; anything else
 * still throws to the admin error boundary.
 */

const ARTISTS_PATH = "/content/artists";

/** Owner-facing message for a known Prisma failure, or null to rethrow. */
function friendlyError(err: unknown): string | null {
  const fields = uniqueViolationFields(err);
  if (fields) {
    if (violates(fields, "email"))
      return "Another user already has that email.";
    if (violates(fields, "slug"))
      return "Another artist already uses that slug — pick a different one.";
    return "That email or slug is already in use.";
  }
  return knownDbError(err);
}

async function write(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
  } catch (err) {
    const message = friendlyError(err);
    if (message) return fail(message);
    throw err;
  }
  revalidatePath(ARTISTS_PATH);
  return OK;
}

export async function createArtist(fd: FormData): Promise<ActionResult> {
  await requireRole("OWNER");
  const coerced = coerceArtist(fd);
  const invalid = artistInputError(coerced, true);
  if (invalid) return fail(invalid);
  const { profile, styleIds, email, accessRole } = coerced;
  const slug = profile.slug || slugify(profile.name);

  return write(() =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: (email ?? "").toLowerCase(),
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
    }),
  );
}

export async function updateArtist(fd: FormData): Promise<ActionResult> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const coerced = coerceArtist(fd);
  const invalid = artistInputError(coerced, false);
  if (invalid) return fail(invalid);
  const { profile, styleIds } = coerced;
  const slug = profile.slug || slugify(profile.name);

  return write(() =>
    prisma.artist.update({
      where: { id },
      data: {
        ...profile,
        slug,
        styles: { set: styleIds.map((styleId) => ({ id: styleId })) },
      },
    }),
  );
}

const ARTIST_HAS_CONSENT_FORMS =
  "This artist has signed consent forms on file, so they can't be deleted — use “Hide from site” to take them off the website instead.";

/**
 * Deleting an artist cascades to their bookings, and a booking with a signed
 * consent form is protected (`ConsentForm` → `Booking` is onDelete: Restrict:
 * it is a licensing record). Refuse up front with a message the editor shows
 * inline; the P2003 catch covers a form signed between the check and the
 * delete.
 */
export async function deleteArtist(fd: FormData): Promise<ActionResult> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const signedForms = await prisma.consentForm.count({
    where: { booking: { artistId: id } },
  });
  if (signedForms > 0) return fail(ARTIST_HAS_CONSENT_FORMS);
  try {
    await prisma.artist.delete({ where: { id } });
  } catch (err) {
    if ((err as { code?: unknown })?.code === "P2003") {
      return fail(ARTIST_HAS_CONSENT_FORMS);
    }
    const message = friendlyError(err);
    if (message) return fail(message);
    throw err;
  }
  revalidatePath(ARTISTS_PATH);
  return OK;
}
