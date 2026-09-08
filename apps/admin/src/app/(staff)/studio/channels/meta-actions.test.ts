import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { META_STATE_COOKIE } from "@bnb/core/services/channels/meta-oauth";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireRole = vi.fn();
const deleteConnection = vi.fn();
const getConnection = vi.fn();
const listChannelConnections = vi.fn();
const unsubscribeApp = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete, get: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@bnb/core/services/channel-connections", () => ({
  deleteConnection: (...a: unknown[]) => deleteConnection(...a),
  getConnection: (...a: unknown[]) => getConnection(...a),
  listChannelConnections: (...a: unknown[]) => listChannelConnections(...a),
  // meta-oauth (imported for real, for the dialog URL) pulls this in; stubbed
  // so the suite never reaches Prisma.
  upsertChannelConnection: vi.fn(),
}));

// Everything except the Graph transport is the real module: the dialog URL,
// the cookie name and the TTL are the contract this action shares with the
// callback route, and stubbing them would stop testing it.
vi.mock("@bnb/core/services/channels/meta-oauth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  metaOAuthDeps: () => ({ unsubscribeApp: (...a: unknown[]) => unsubscribeApp(...a) }),
}));

const { connectMetaAction, disconnectMetaAction } =
  await import("./meta-actions");

const CONNECTION = {
  id: "conn1",
  channel: "messenger" as const,
  externalId: "102938475610293",
  pageId: "102938475610293",
  igAccountId: null,
  name: "Boots 'n' Bandit",
  active: true,
  webhookSubscribedAt: new Date("2026-09-05T10:00:00Z"),
  lastEventAt: null,
  connectedAt: new Date("2026-09-05T10:00:00Z"),
  tokenReadable: true,
  accessToken: "EAAG_synthetic_page_token",
};

const ORIGINAL = {
  appId: process.env.META_APP_ID,
  appSecret: process.env.META_APP_SECRET,
  origin: process.env.APP_ORIGIN,
  sessionSecret: process.env.SESSION_SECRET,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = "1234567890";
  process.env.META_APP_SECRET = "synthetic-app-secret";
  process.env.APP_ORIGIN = "https://admin.example.test";
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
  getConnection.mockResolvedValue(CONNECTION);
  listChannelConnections.mockResolvedValue([CONNECTION]);
  deleteConnection.mockResolvedValue(1);
  unsubscribeApp.mockResolvedValue(true);
});

afterEach(() => {
  for (const [key, value] of Object.entries({
    META_APP_ID: ORIGINAL.appId,
    META_APP_SECRET: ORIGINAL.appSecret,
    APP_ORIGIN: ORIGINAL.origin,
    SESSION_SECRET: ORIGINAL.sessionSecret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("connectMetaAction", () => {
  it("is owner-only", async () => {
    await expect(connectMetaAction()).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith("OWNER");
  });

  it("stores a short-lived httpOnly state nonce and redirects to Meta", async () => {
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);

    const [name, value, options] = cookieSet.mock.calls[0];
    expect(name).toBe(META_STATE_COOKIE);
    expect(name).toBe("bb_meta_oauth_state");
    expect(String(value).length).toBeGreaterThan(20);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const url = new URL(String(redirect.mock.calls[0][0]));
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.searchParams.get("state")).toBe(value);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.test/api/meta/oauth/callback",
    );
  });

  it("mints a fresh nonce every time", async () => {
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(cookieSet.mock.calls[0][1]).not.toBe(cookieSet.mock.calls[1][1]);
  });

  it("redirects back with an error when the app is not configured", async () => {
    delete process.env.META_APP_ID;
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_error=not_configured",
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("also refuses when the callback origin is unknown", async () => {
    delete process.env.APP_ORIGIN;
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_error=not_configured",
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("also refuses without the app secret, which the exchange needs", async () => {
    delete process.env.META_APP_SECRET;
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_error=not_configured",
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("names the real problem when SESSION_SECRET is too short to store a token", async () => {
    // Not "not_configured": the Meta app is fine, the key that encrypts the
    // page token is not — and only one of those two messages is actionable.
    process.env.SESSION_SECRET = "too-short";
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_error=session_secret",
    );
    expect(cookieSet).not.toHaveBeenCalled();

    delete process.env.SESSION_SECRET;
    redirect.mockClear();
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_error=session_secret",
    );
  });

  it("marks the state cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(cookieSet.mock.calls[0][2]).toMatchObject({ secure: true });
    vi.unstubAllEnvs();
  });
});

describe("disconnectMetaAction", () => {
  const form = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    return fd;
  };

  it("tells Facebook to stop delivering BEFORE it drops the row", async () => {
    // Order matters: the token lives on the row, so deleting first leaves the
    // app subscribed with no way left to unsubscribe it.
    await disconnectMetaAction(form("conn1"));
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(unsubscribeApp).toHaveBeenCalledWith({
      pageId: "102938475610293",
      pageToken: "EAAG_synthetic_page_token",
    });
    expect(unsubscribeApp.mock.invocationCallOrder[0]).toBeLessThan(
      deleteConnection.mock.invocationCallOrder[0],
    );
    expect(deleteConnection).toHaveBeenCalledWith("conn1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("leaves the subscription alone when another row shares the Page", async () => {
    // An Instagram connection rides on the same Page token; unsubscribing for
    // the Messenger row would silently kill the Instagram one too.
    listChannelConnections.mockResolvedValue([
      CONNECTION,
      {
        ...CONNECTION,
        id: "conn2",
        channel: "instagram" as const,
        externalId: "17841400000000000",
      },
    ]);
    await disconnectMetaAction(form("conn1"));
    expect(unsubscribeApp).not.toHaveBeenCalled();
    expect(deleteConnection).toHaveBeenCalledWith("conn1");
  });

  it("still disconnects when Facebook refuses the unsubscribe, and says so", async () => {
    unsubscribeApp.mockResolvedValue(false);
    await expect(disconnectMetaAction(form("conn1"))).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
    expect(deleteConnection).toHaveBeenCalledWith("conn1");
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_warning=unsubscribe_failed",
    );
  });

  it("does nothing without an id, rather than throwing at the owner", async () => {
    await disconnectMetaAction(new FormData());
    expect(deleteConnection).not.toHaveBeenCalled();
    expect(unsubscribeApp).not.toHaveBeenCalled();
  });

  it("still removes a row whose token can no longer be read", async () => {
    // Nothing to unsubscribe WITH — but the owner asked for it gone.
    getConnection.mockResolvedValue(null);
    await disconnectMetaAction(form("conn1"));
    expect(unsubscribeApp).not.toHaveBeenCalled();
    expect(deleteConnection).toHaveBeenCalledWith("conn1");
  });
});
