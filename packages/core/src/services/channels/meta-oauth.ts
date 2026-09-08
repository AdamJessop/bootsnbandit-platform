import { createHmac } from "node:crypto";
import {
  upsertChannelConnection,
  type ChannelConnectionRow,
} from "../channel-connections";
import { metaGraphUrl, metaGraphVersion } from "./meta";

/**
 * Facebook Login for Business → `ChannelConnection` rows.
 *
 * The owner is sent to Meta's OAuth dialog, comes back with a `code`, and this
 * module turns it into: a short-lived user token → a long-lived user token →
 * the Pages that account manages (each with its own page token) → one
 * connection per Page plus one per linked Instagram business account → a
 * webhook subscription on each Page.
 *
 * Every network call is behind `MetaOAuthDeps`, so the whole orchestration is
 * testable without a socket.
 */

/**
 * pages_messaging          send and receive Messenger messages
 * pages_manage_metadata    subscribe the app to the Page's webhooks
 * pages_show_list          enumerate the Pages the account manages
 * instagram_basic          read the linked IG business account
 * instagram_manage_messages send and receive Instagram DMs
 * business_management      required for App Review of the above
 */
export const META_OAUTH_SCOPES = [
  "pages_messaging",
  "pages_manage_metadata",
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
] as const;

/** The webhook fields each connected Page is subscribed to. */
export const META_SUBSCRIBED_FIELDS =
  "messages,message_echoes,messaging_postbacks";

/**
 * The single-use CSRF nonce the connect action mints and the callback checks.
 *
 * It lives here rather than in the admin action module because a `"use server"`
 * file may only export async functions — Next refuses any other export — and
 * both the action and the callback route must agree on the name and the TTL.
 */
export const META_STATE_COOKIE = "bb_meta_oauth_state";
export const META_STATE_TTL_SECONDS = 600;

/**
 * The one redirect URI. It must be byte-identical in the dialog and in the
 * code exchange or Meta rejects the exchange, so both callers derive it here.
 */
export function metaRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const origin = env.APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return `${origin}/api/meta/oauth/callback`;
}

export function metaLoginDialogUrl(input: {
  appId: string;
  redirectUri: string;
  /** Single-use nonce, echoed back by Meta — the CSRF guard on the callback. */
  state: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const url = new URL(
    `https://www.facebook.com/${metaGraphVersion(input.env)}/dialog/oauth`,
  );
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_OAUTH_SCOPES.join(","));
  return url.toString();
}

export interface MetaPageAccount {
  id: string;
  name: string;
  accessToken: string;
  igAccountId: string | null;
  igUsername: string | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** `/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}` */
export function parseMetaAccounts(body: unknown): MetaPageAccount[] {
  if (typeof body !== "object" || body === null) return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  const out: MetaPageAccount[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const page = item as {
      id?: unknown;
      name?: unknown;
      access_token?: unknown;
      instagram_business_account?: { id?: unknown; username?: unknown };
    };
    const id = str(page.id);
    const accessToken = str(page.access_token);
    // A Page with no token is a Page we cannot act on — skip it rather than
    // storing a connection that can never send.
    if (!id || !accessToken) continue;
    out.push({
      id,
      name: str(page.name) ?? id,
      accessToken,
      igAccountId: str(page.instagram_business_account?.id),
      igUsername: str(page.instagram_business_account?.username),
    });
  }
  return out;
}

export interface MetaOAuthDeps {
  exchangeCode(input: { code: string; redirectUri: string }): Promise<string>;
  exchangeLongLived(userToken: string): Promise<string>;
  listAccounts(userToken: string): Promise<MetaPageAccount[]>;
  subscribeApp(input: { pageId: string; pageToken: string }): Promise<boolean>;
}

const OAUTH_TIMEOUT_MS = 15_000;

/** Graph error bodies carry the useful message; never echo the request back. */
async function graphJson(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json()) as Record<string, unknown>;
  const error = body.error as { message?: unknown } | undefined;
  if (error) {
    throw new Error(
      typeof error.message === "string" ? error.message : "Graph API error",
    );
  }
  if (!res.ok) throw new Error(`Graph API returned ${res.status}`);
  return body;
}

/**
 * `appsecret_proof` = HMAC-SHA256 of the access token, keyed by the app
 * secret. Meta uses it to prove the caller holds the secret without sending
 * it; it is a proof, not a credential, so it may travel as a query parameter.
 */
export function appSecretProof(token: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(token, "utf8").digest("hex");
}

export function metaOAuthDeps(
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): MetaOAuthDeps {
  function credentials(): { appId: string; appSecret: string } {
    const appId = env.META_APP_ID?.trim();
    const appSecret = env.META_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new Error(
        "META_APP_ID and META_APP_SECRET must both be set to connect a Page.",
      );
    }
    return { appId, appSecret };
  }

  /**
   * Secrets and tokens travel in a form BODY, never in the URL. A query string
   * is the one part of an HTTPS request that leaks: proxy and CDN access logs,
   * `Referer`, browser history, our own error reporting. Graph accepts POST
   * with `application/x-www-form-urlencoded` on every endpoint below.
   */
  async function postForm(path: string, fields: Record<string, string>) {
    const res = await fetchImpl(metaGraphUrl(path, env), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    return graphJson(res);
  }

  /**
   * Read edges are GET (Graph rejects POST on `/me/accounts`), so the token
   * rides in an `Authorization: Bearer` header instead of `?access_token=`.
   */
  async function getAs(
    path: string,
    token: string,
    params: Record<string, string> = {},
  ) {
    const { appSecret } = credentials();
    const url = new URL(metaGraphUrl(path, env));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("appsecret_proof", appSecretProof(token, appSecret));
    const res = await fetchImpl(url.toString(), {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    return graphJson(res);
  }

  return {
    async exchangeCode({ code, redirectUri }) {
      const { appId, appSecret } = credentials();
      // No `appsecret_proof`: this call is authenticated by the secret itself,
      // and there is no access token yet to prove anything about.
      const body = await postForm("oauth/access_token", {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      });
      const token = str(body.access_token);
      if (!token) throw new Error("Meta returned no access token for the code.");
      return token;
    },

    async exchangeLongLived(userToken) {
      const { appId, appSecret } = credentials();
      const body = await postForm("oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userToken,
      });
      const token = str(body.access_token);
      if (!token) throw new Error("Meta returned no long-lived access token.");
      return token;
    },

    async listAccounts(userToken) {
      const body = await getAs("me/accounts", userToken, {
        // The IG business account comes back on the same read, so there is no
        // second `/{pageId}?fields=instagram_business_account` round trip.
        fields: "id,name,access_token,instagram_business_account{id,username}",
      });
      return parseMetaAccounts(body);
    },

    async subscribeApp({ pageId, pageToken }) {
      try {
        const { appSecret } = credentials();
        const body = (await postForm(`${pageId}/subscribed_apps`, {
          subscribed_fields: META_SUBSCRIBED_FIELDS,
          access_token: pageToken,
          appsecret_proof: appSecretProof(pageToken, appSecret),
        })) as { success?: unknown };
        return body.success !== false;
      } catch (err) {
        // The message can name the app; the token never appears in it because
        // it was never in the URL. A failed subscription is not fatal — the
        // connection is kept and the owner is told to retry.
        console.error(`[meta] subscribe failed for page ${pageId}:`, err);
        return false;
      }
    },
  };
}

export interface ConnectMetaResult {
  connected: ChannelConnectionRow[];
  /** Things the owner should know, shown as a flash. Never fatal. */
  warnings: string[];
}

export async function connectMetaPages(input: {
  code: string;
  redirectUri: string;
  deps?: MetaOAuthDeps;
}): Promise<ConnectMetaResult> {
  const deps = input.deps ?? metaOAuthDeps();

  const shortLived = await deps.exchangeCode({
    code: input.code,
    redirectUri: input.redirectUri,
  });
  // Short-lived tokens last ~1 hour; the long-lived one lasts ~60 days and is
  // what makes the page tokens below effectively permanent.
  const longLived = await deps.exchangeLongLived(shortLived);
  const pages = await deps.listAccounts(longLived);

  if (pages.length === 0) {
    return {
      connected: [],
      warnings: [
        "That Facebook account manages no Pages this app can use — check you granted access to the studio Page.",
      ],
    };
  }

  const connected: ChannelConnectionRow[] = [];
  const warnings: string[] = [];

  for (const page of pages) {
    // Subscribe FIRST so the stored `webhookSubscribedAt` reflects reality.
    const subscribed = await deps.subscribeApp({
      pageId: page.id,
      pageToken: page.accessToken,
    });
    if (!subscribed) {
      warnings.push(
        `${page.name}: connected, but the webhook subscription failed — retry Connect.`,
      );
    }
    const webhookSubscribedAt = subscribed ? new Date() : null;

    connected.push(
      await upsertChannelConnection({
        channel: "messenger",
        externalId: page.id,
        pageId: page.id,
        igAccountId: page.igAccountId,
        name: page.name,
        accessToken: page.accessToken,
        webhookSubscribedAt,
      }),
    );

    if (page.igAccountId) {
      connected.push(
        await upsertChannelConnection({
          channel: "instagram",
          // Instagram webhooks address the IG business account id…
          externalId: page.igAccountId,
          // …but a send goes through the PAGE endpoint, so the page id rides
          // along. The same page token authorises both.
          pageId: page.id,
          igAccountId: page.igAccountId,
          name: page.igUsername
            ? `${page.name} (@${page.igUsername})`
            : `${page.name} (Instagram)`,
          accessToken: page.accessToken,
          webhookSubscribedAt,
        }),
      );
    }
  }

  return { connected, warnings };
}
