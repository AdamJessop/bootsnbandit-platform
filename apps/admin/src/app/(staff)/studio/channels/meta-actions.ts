"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@bnb/core/auth";
import { generateToken } from "@bnb/core/auth/tokens";
import {
  deleteConnection,
  getConnection,
  listChannelConnections,
} from "@bnb/core/services/channel-connections";
import {
  metaLoginDialogUrl,
  metaOAuthDeps,
  metaRedirectUri,
  META_STATE_COOKIE,
  META_STATE_TTL_SECONDS,
} from "@bnb/core/services/channels/meta-oauth";
import { MIN_SESSION_SECRET_CHARS } from "@bnb/core/services/secrets";

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
  // rejects — so an unset APP_ORIGIN is "not configured" too. The app SECRET
  // is needed by the code exchange the callback runs; finding that out three
  // redirects later, as a Graph failure, helps nobody.
  if (
    !appId ||
    !process.env.META_APP_SECRET?.trim() ||
    !process.env.APP_ORIGIN?.trim()
  ) {
    redirect(`${CHANNELS_PATH}?meta_error=not_configured`);
  }

  // The page token is encrypted with a key derived from SESSION_SECRET, so a
  // secret that is too short means the connection cannot be STORED — a
  // different problem with a different fix from "the Meta app is not set up".
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret || sessionSecret.length < MIN_SESSION_SECRET_CHARS) {
    redirect(`${CHANNELS_PATH}?meta_error=session_secret`);
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

/**
 * Disconnect: tell Facebook to stop delivering, THEN drop the row.
 *
 * Deleting alone is not enough. The app stays subscribed to the Page, Meta
 * keeps POSTing, and every one of those deliveries is then dropped as
 * `unknown_page` — the customer sees a business that reads nothing.
 *
 * The unsubscribe must come first because the token lives on the row we are
 * about to delete, and it must be skipped when another ACTIVE connection still
 * uses the same Page (an Instagram row rides on the Messenger row's token):
 * unsubscribing would take that one down too. Failure is never fatal — the row
 * goes either way, and the owner is told to finish the job in Business
 * Settings.
 */
export async function disconnectMetaAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  // A missing id is a hidden-input value the owner never typed — no-op rather
  // than throwing them into an error boundary.
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;

  // Null when the row is gone or its token no longer decrypts: nothing to
  // unsubscribe WITH, but the owner still asked for the row to go.
  const connection = await getConnection(id);
  let unsubscribeFailed = false;

  if (connection) {
    const rows = await listChannelConnections();
    const sharesPage = rows.some(
      (row) => row.id !== id && row.active && row.pageId === connection.pageId,
    );
    if (!sharesPage) {
      unsubscribeFailed = !(await metaOAuthDeps().unsubscribeApp({
        pageId: connection.pageId,
        pageToken: connection.accessToken,
      }));
    }
  }

  await deleteConnection(id);
  revalidatePath(CHANNELS_PATH);
  if (unsubscribeFailed) {
    redirect(`${CHANNELS_PATH}?meta_warning=unsubscribe_failed`);
  }
}
