import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertChannelConnection = vi.fn();
vi.mock("../channel-connections", () => ({
  upsertChannelConnection: (...a: unknown[]) => upsertChannelConnection(...a),
}));

const {
  appSecretProof,
  connectMetaPages,
  metaLoginDialogUrl,
  metaOAuthDeps,
  metaRedirectUri,
  META_OAUTH_SCOPES,
  META_STATE_COOKIE,
  META_STATE_TTL_SECONDS,
  META_SUBSCRIBED_FIELDS,
  parseMetaAccounts,
} = await import("./meta-oauth");

const ACCOUNTS_BODY = {
  data: [
    {
      id: "102938475610293",
      name: "Boots 'n' Bandit",
      access_token: "EAAG_page_token_synthetic",
      instagram_business_account: {
        id: "17841400000000000",
        username: "bootsnbandit",
      },
    },
    {
      id: "204958671029384",
      name: "Boots 'n' Bandit Flash",
      access_token: "EAAG_second_page_token",
    },
    { id: "no-token-page", name: "Broken" },
  ],
};

describe("metaLoginDialogUrl", () => {
  it("builds the Facebook Login for Business dialog with every scope we need", () => {
    const url = new URL(
      metaLoginDialogUrl({
        appId: "1234567890",
        redirectUri: "https://admin.example.test/api/meta/oauth/callback",
        state: "nonce-abc",
        env: {} as NodeJS.ProcessEnv,
      }),
    );
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v21.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("1234567890");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.test/api/meta/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe("nonce-abc");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      ...META_OAUTH_SCOPES,
    ]);
    expect([...META_OAUTH_SCOPES]).toEqual([
      "pages_messaging",
      "pages_manage_metadata",
      "pages_show_list",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ]);
  });
});

describe("the state nonce contract", () => {
  it("names one cookie and one TTL for both the action and the callback", () => {
    // Pinned to the literals: the connect action writes this cookie and the
    // callback route reads it, so a rename in one place must break a test.
    expect(META_STATE_COOKIE).toBe("bb_meta_oauth_state");
    expect(META_STATE_TTL_SECONDS).toBe(600);
  });
});

describe("metaRedirectUri", () => {
  it("is the callback under APP_ORIGIN, with no double slash", () => {
    expect(
      metaRedirectUri({ APP_ORIGIN: "https://admin.example.test" } as NodeJS.ProcessEnv),
    ).toBe("https://admin.example.test/api/meta/oauth/callback");
    expect(
      metaRedirectUri({ APP_ORIGIN: "https://admin.example.test/" } as NodeJS.ProcessEnv),
    ).toBe("https://admin.example.test/api/meta/oauth/callback");
  });
});

describe("parseMetaAccounts", () => {
  it("reads each page with a token, and its linked IG account", () => {
    expect(parseMetaAccounts(ACCOUNTS_BODY)).toEqual([
      {
        id: "102938475610293",
        name: "Boots 'n' Bandit",
        accessToken: "EAAG_page_token_synthetic",
        igAccountId: "17841400000000000",
        igUsername: "bootsnbandit",
      },
      {
        id: "204958671029384",
        name: "Boots 'n' Bandit Flash",
        accessToken: "EAAG_second_page_token",
        igAccountId: null,
        igUsername: null,
      },
    ]);
  });

  it("returns nothing for junk instead of throwing", () => {
    expect(parseMetaAccounts(null)).toEqual([]);
    expect(parseMetaAccounts({})).toEqual([]);
    expect(parseMetaAccounts({ data: "nope" })).toEqual([]);
  });

  it("refuses a page or IG id that is not a plain number", () => {
    // Both ids end up interpolated into a Graph path and stored as the
    // `externalId` a webhook is matched on — anything but digits is not an id.
    expect(
      parseMetaAccounts({
        data: [
          {
            id: "102938475610293/../me",
            name: "Traversal",
            access_token: "EAAG_x",
          },
        ],
      }),
    ).toEqual([]);

    expect(
      parseMetaAccounts({
        data: [
          {
            id: "102938475610293",
            name: "Odd IG",
            access_token: "EAAG_x",
            instagram_business_account: { id: "not-a-number", username: "x" },
          },
        ],
      }),
    ).toEqual([
      {
        id: "102938475610293",
        name: "Odd IG",
        accessToken: "EAAG_x",
        igAccountId: null,
        igUsername: "x",
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// The Graph transport: nothing secret may ever reach a URL.
// ---------------------------------------------------------------------------

const ENV = {
  META_APP_ID: "1234567890",
  META_APP_SECRET: "app-secret-synthetic",
} as NodeJS.ProcessEnv;

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: URLSearchParams;
}

function stubFetch(bodies: unknown[]) {
  const calls: Recorded[] = [];
  const queue = [...bodies];
  const impl = vi.fn(async (input: unknown, init?: RequestInit) => {
    const raw = typeof init?.body === "string" ? init.body : "";
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: new URLSearchParams(raw),
    });
    const body = queue.shift() ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response;
  });
  return { fetchImpl: impl as unknown as typeof fetch, calls };
}

/** Every value that must never be visible in an access log or a Referer. */
const NEVER_IN_A_URL = [
  "client_secret=",
  "access_token=",
  "fb_exchange_token=",
  "app-secret-synthetic",
  "EAAG_page_token_synthetic",
];

function expectNoSecretsInUrls(calls: Recorded[]) {
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) {
    for (const needle of NEVER_IN_A_URL) {
      expect(call.url).not.toContain(needle);
    }
  }
}

describe("metaOAuthDeps", () => {
  it("exchanges the code with the secret in the BODY, never the query string", async () => {
    const { fetchImpl, calls } = stubFetch([{ access_token: "SHORT" }]);
    const token = await metaOAuthDeps(fetchImpl, ENV).exchangeCode({
      code: "THE_CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
    });

    expect(token).toBe("SHORT");
    expect(calls[0].url).toBe(
      "https://graph.facebook.com/v21.0/oauth/access_token",
    );
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(calls[0].body.get("client_id")).toBe("1234567890");
    expect(calls[0].body.get("client_secret")).toBe("app-secret-synthetic");
    expect(calls[0].body.get("code")).toBe("THE_CODE");
    expect(calls[0].body.get("redirect_uri")).toBe(
      "https://admin.example.test/api/meta/oauth/callback",
    );
    // Belt and braces: the code is single-use, but it is still not URL cargo.
    expect(calls[0].url).not.toContain("THE_CODE");
    expectNoSecretsInUrls(calls);
  });

  it("exchanges for a long-lived token with the secret in the BODY", async () => {
    const { fetchImpl, calls } = stubFetch([{ access_token: "LONG" }]);
    const token = await metaOAuthDeps(fetchImpl, ENV).exchangeLongLived("SHORT");

    expect(token).toBe("LONG");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.get("grant_type")).toBe("fb_exchange_token");
    expect(calls[0].body.get("fb_exchange_token")).toBe("SHORT");
    expect(calls[0].body.get("client_secret")).toBe("app-secret-synthetic");
    expectNoSecretsInUrls(calls);
  });

  it("lists accounts with a Bearer header and an appsecret_proof", async () => {
    const { fetchImpl, calls } = stubFetch([ACCOUNTS_BODY]);
    const pages = await metaOAuthDeps(fetchImpl, ENV).listAccounts("LONG");

    expect(pages).toHaveLength(2);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].headers.authorization).toBe("Bearer LONG");

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/v21.0/me/accounts");
    expect(url.searchParams.get("fields")).toBe(
      "id,name,access_token,instagram_business_account{id,username}",
    );
    // A proof, not a secret: it is an HMAC of the token under the app secret,
    // so it is safe in the query string and Meta requires it there.
    expect(url.searchParams.get("appsecret_proof")).toBe(
      createHmac("sha256", "app-secret-synthetic").update("LONG").digest("hex"),
    );
    expectNoSecretsInUrls(calls);
  });

  it("subscribes with the page token in the BODY", async () => {
    const { fetchImpl, calls } = stubFetch([{ success: true }]);
    const ok = await metaOAuthDeps(fetchImpl, ENV).subscribeApp({
      pageId: "102938475610293",
      pageToken: "EAAG_page_token_synthetic",
    });

    expect(ok).toBe(true);
    expect(calls[0].url).toBe(
      "https://graph.facebook.com/v21.0/102938475610293/subscribed_apps",
    );
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.get("subscribed_fields")).toBe(META_SUBSCRIBED_FIELDS);
    expect(calls[0].body.get("access_token")).toBe(
      "EAAG_page_token_synthetic",
    );
    expect(calls[0].body.get("appsecret_proof")).toBe(
      appSecretProof("EAAG_page_token_synthetic", "app-secret-synthetic"),
    );
    expectNoSecretsInUrls(calls);
  });

  it("treats a subscription response with no success flag as a failure", async () => {
    // Graph answers `{"success":true}` on success. An empty body is Graph
    // telling us nothing — believing it would store a webhookSubscribedAt for
    // a Page that never got subscribed.
    const { fetchImpl } = stubFetch([{}]);
    expect(
      await metaOAuthDeps(fetchImpl, ENV).subscribeApp({
        pageId: "102938475610293",
        pageToken: "EAAG_page_token_synthetic",
      }),
    ).toBe(false);
  });

  it("unsubscribes with a DELETE and the page token OUT of the URL", async () => {
    const { fetchImpl, calls } = stubFetch([{ success: true }]);
    const ok = await metaOAuthDeps(fetchImpl, ENV).unsubscribeApp({
      pageId: "102938475610293",
      pageToken: "EAAG_page_token_synthetic",
    });

    expect(ok).toBe(true);
    expect(calls[0].url).toBe(
      "https://graph.facebook.com/v21.0/102938475610293/subscribed_apps",
    );
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].body.get("access_token")).toBe("EAAG_page_token_synthetic");
    expect(calls[0].body.get("appsecret_proof")).toBe(
      appSecretProof("EAAG_page_token_synthetic", "app-secret-synthetic"),
    );
    expectNoSecretsInUrls(calls);
  });

  it("reports a refused unsubscribe as false rather than throwing", async () => {
    const { fetchImpl } = stubFetch([
      { error: { message: "(#200) Requires pages_manage_metadata" } },
    ]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await metaOAuthDeps(fetchImpl, ENV).unsubscribeApp({
      pageId: "p1",
      pageToken: "EAAG_page_token_synthetic",
    });
    expect(ok).toBe(false);
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("EAAG_page_token_synthetic");
    }
    spy.mockRestore();
  });

  it("reports a refused subscription as false rather than throwing", async () => {
    const { fetchImpl } = stubFetch([
      { error: { message: "(#200) Requires pages_manage_metadata" } },
    ]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await metaOAuthDeps(fetchImpl, ENV).subscribeApp({
      pageId: "p1",
      pageToken: "EAAG_page_token_synthetic",
    });
    expect(ok).toBe(false);
    // Whatever we log about the failure, it is not the token.
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("EAAG_page_token_synthetic");
    }
    spy.mockRestore();
  });

  it("surfaces Graph's own message when an exchange fails", async () => {
    const { fetchImpl } = stubFetch([
      { error: { message: "This authorization code has been used." } },
    ]);
    await expect(
      metaOAuthDeps(fetchImpl, ENV).exchangeCode({
        code: "REUSED",
        redirectUri: "https://x.test/cb",
      }),
    ).rejects.toThrow("This authorization code has been used.");
  });

  it("refuses to call Meta at all when the app is not configured", async () => {
    const { fetchImpl, calls } = stubFetch([{ access_token: "SHORT" }]);
    await expect(
      metaOAuthDeps(fetchImpl, {} as NodeJS.ProcessEnv).exchangeCode({
        code: "CODE",
        redirectUri: "https://x.test/cb",
      }),
    ).rejects.toThrow(/META_APP_ID and META_APP_SECRET/);
    expect(calls).toHaveLength(0);
  });
});

describe("connectMetaPages", () => {
  const deps = {
    exchangeCode: vi.fn(async () => "SHORT_USER_TOKEN"),
    exchangeLongLived: vi.fn(async () => "LONG_USER_TOKEN"),
    listAccounts: vi.fn(async () => parseMetaAccounts(ACCOUNTS_BODY)),
    subscribeApp: vi.fn(async () => true),
    unsubscribeApp: vi.fn(async () => true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.exchangeCode.mockResolvedValue("SHORT_USER_TOKEN");
    deps.exchangeLongLived.mockResolvedValue("LONG_USER_TOKEN");
    deps.listAccounts.mockResolvedValue(parseMetaAccounts(ACCOUNTS_BODY));
    deps.subscribeApp.mockResolvedValue(true);
    upsertChannelConnection.mockImplementation(
      async (input: { externalId: string; channel: string; name: string }) => ({
        id: `row-${input.externalId}`,
        ...input,
      }),
    );
  });

  it("exchanges the code for a long-lived token, then stores one row per destination", async () => {
    const result = await connectMetaPages({
      code: "CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
      deps,
    });

    expect(deps.exchangeCode).toHaveBeenCalledWith({
      code: "CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
    });
    expect(deps.exchangeLongLived).toHaveBeenCalledWith("SHORT_USER_TOKEN");
    expect(deps.listAccounts).toHaveBeenCalledWith("LONG_USER_TOKEN");

    // Two pages + one linked Instagram account = three connections.
    expect(result.connected).toHaveLength(3);
    expect(result.warnings).toEqual([]);
    expect(upsertChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "messenger",
        externalId: "102938475610293",
        pageId: "102938475610293",
        igAccountId: "17841400000000000",
        name: "Boots 'n' Bandit",
        accessToken: "EAAG_page_token_synthetic",
      }),
    );
    expect(upsertChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "instagram",
        externalId: "17841400000000000",
        // The IG row carries the PAGE id: an Instagram send goes through the
        // page's /messages endpoint, and the IG id alone cannot route it.
        pageId: "102938475610293",
        name: "Boots 'n' Bandit (@bootsnbandit)",
        accessToken: "EAAG_page_token_synthetic",
      }),
    );
  });

  it("subscribes the app to the messaging fields for each page", async () => {
    await connectMetaPages({ code: "CODE", redirectUri: "https://x.test/cb", deps });
    expect(deps.subscribeApp).toHaveBeenCalledTimes(2);
    expect(deps.subscribeApp).toHaveBeenCalledWith({
      pageId: "102938475610293",
      pageToken: "EAAG_page_token_synthetic",
    });
    expect(META_SUBSCRIBED_FIELDS).toBe(
      "messages,message_echoes,messaging_postbacks",
    );
    expect(
      upsertChannelConnection.mock.calls[0][0].webhookSubscribedAt,
    ).toBeInstanceOf(Date);
  });

  it("still connects a page whose subscription failed, and says so", async () => {
    deps.subscribeApp.mockResolvedValue(false);
    const result = await connectMetaPages({
      code: "CODE",
      redirectUri: "https://x.test/cb",
      deps,
    });
    expect(result.connected).toHaveLength(3);
    expect(result.warnings).toEqual([
      "Boots 'n' Bandit: connected, but the webhook subscription failed — retry Connect.",
      "Boots 'n' Bandit Flash: connected, but the webhook subscription failed — retry Connect.",
    ]);
    expect(upsertChannelConnection.mock.calls[0][0].webhookSubscribedAt).toBeNull();
  });

  it("reports no pages rather than pretending to succeed", async () => {
    deps.listAccounts.mockResolvedValue([]);
    const result = await connectMetaPages({
      code: "CODE",
      redirectUri: "https://x.test/cb",
      deps,
    });
    expect(result.connected).toEqual([]);
    expect(result.warnings).toEqual([
      "That Facebook account manages no Pages this app can use — check you granted access to the studio Page.",
    ]);
  });
});
