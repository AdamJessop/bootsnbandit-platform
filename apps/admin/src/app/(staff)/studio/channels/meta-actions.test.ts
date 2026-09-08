import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { META_STATE_COOKIE } from "@bnb/core/services/channels/meta-oauth";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireRole = vi.fn();
const deleteConnection = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete, get: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@bnb/core/services/channel-connections", () => ({
  deleteConnection: (...a: unknown[]) => deleteConnection(...a),
  // meta-oauth (imported for real, for the dialog URL) pulls this in; stubbed
  // so the suite never reaches Prisma.
  upsertChannelConnection: vi.fn(),
}));

const { connectMetaAction, disconnectMetaAction } =
  await import("./meta-actions");

const ORIGINAL = {
  appId: process.env.META_APP_ID,
  origin: process.env.APP_ORIGIN,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = "1234567890";
  process.env.APP_ORIGIN = "https://admin.example.test";
  requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
});

afterEach(() => {
  if (ORIGINAL.appId === undefined) delete process.env.META_APP_ID;
  else process.env.META_APP_ID = ORIGINAL.appId;
  if (ORIGINAL.origin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = ORIGINAL.origin;
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
});

describe("disconnectMetaAction", () => {
  it("deletes the connection an owner named", async () => {
    const fd = new FormData();
    fd.set("id", "conn1");
    await disconnectMetaAction(fd);
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(deleteConnection).toHaveBeenCalledWith("conn1");
  });

  it("does nothing without an id, rather than throwing at the owner", async () => {
    await disconnectMetaAction(new FormData());
    expect(deleteConnection).not.toHaveBeenCalled();
  });
});
