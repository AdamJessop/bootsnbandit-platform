"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@bnb/core/auth";
import { generateToken } from "@bnb/core/auth/tokens";
import { deleteConnection } from "@bnb/core/services/channel-connections";
import {
  metaLoginDialogUrl,
  metaRedirectUri,
  META_STATE_COOKIE,
  META_STATE_TTL_SECONDS,
} from "@bnb/core/services/channels/meta-oauth";

/**
 * Connect / disconnect a Facebook Page from Studio › Channels.
 *
 * A server action rather than a `GET /studio/channels/meta/connect` page: it
 * inherits the owner check and Next's action CSRF protection, and it can write
 * the state cookie before redirecting — a plain GET link could be followed by
 * anyone who could get the owner to click it.
 *
 * Only async functions live here: Next refuses any other export from a
 * `"use server"` module, so the cookie name, the TTL and the redirect URI are
 * defined in `@bnb/core/services/channels/meta-oauth` and shared with the
 * callback route from there.
 */

const CHANNELS_PATH = "/studio/channels";

export async function connectMetaAction(): Promise<void> {
  await requireRole("OWNER");

  const appId = process.env.META_APP_ID?.trim();
  // Without an origin the redirect URI would be a bare path, which Meta
  // rejects — so an unset APP_ORIGIN is "not configured" too.
  if (!appId || !process.env.APP_ORIGIN?.trim()) {
    redirect(`${CHANNELS_PATH}?meta_error=not_configured`);
  }

  // Single-use nonce: Meta echoes it back as `state`, and the callback only
  // proceeds when the two match. Without it, anyone could feed the callback a
  // `code` of their own and attach THEIR Page to this studio.
  const state = generateToken(32);
  const jar = await cookies();
  jar.set(META_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // the callback is a top-level GET navigation from Meta
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: META_STATE_TTL_SECONDS,
  });

  redirect(
    metaLoginDialogUrl({
      appId,
      redirectUri: metaRedirectUri(),
      state,
    }),
  );
}

export async function disconnectMetaAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  // A missing id is a hidden-input value the owner never typed — no-op rather
  // than throwing them into an error boundary.
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;
  await deleteConnection(id);
  revalidatePath(CHANNELS_PATH);
}
