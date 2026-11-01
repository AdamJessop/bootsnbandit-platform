import { hkdfSync } from "node:crypto";
import { EncryptJWT } from "jose";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  encodeSession,
  decodeSession,
  renewSessionToken,
  sessionPayloadToUser,
  type SessionPayload,
} from "./session";

const SECRET = "test-only-session-secret-that-is-long-enough-32+";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

const payload: SessionPayload = {
  sub: "user_123",
  email: "owner@example.com",
  role: "OWNER",
  displayName: "Studio Owner",
  artistId: null,
};

describe("session encode/decode", () => {
  it("round-trips a payload through an encrypted token", async () => {
    const token = await encodeSession(payload);
    expect(typeof token).toBe("string");
    // JWE compact serialization has 5 dot-separated parts.
    expect(token.split(".")).toHaveLength(5);

    const decoded = await decodeSession(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(payload.sub);
    expect(decoded?.email).toBe(payload.email);
    expect(decoded?.role).toBe("OWNER");
    expect(decoded?.displayName).toBe("Studio Owner");
  });

  it("returns null for a tampered/garbage token", async () => {
    expect(await decodeSession("not-a-real-token")).toBeNull();
    const token = await encodeSession(payload);
    const tampered = token.slice(0, -3) + "xyz";
    expect(await decodeSession(tampered)).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await encodeSession(payload);
    process.env.SESSION_SECRET = "a-totally-different-secret-key-32-chars-min!";
    const decoded = await decodeSession(token);
    process.env.SESSION_SECRET = SECRET;
    expect(decoded).toBeNull();
  });

  it("maps a session payload to a SessionUser", () => {
    const user = sessionPayloadToUser(payload);
    expect(user).toEqual({
      id: "user_123",
      email: "owner@example.com",
      role: "OWNER",
      displayName: "Studio Owner",
      artistId: null,
    });
  });

  it("preserves the artistId for an artist session", async () => {
    const artistPayload: SessionPayload = {
      sub: "user_a",
      email: "artist@example.com",
      role: "ARTIST",
      displayName: "Bandit",
      artistId: "artist_1",
    };
    const decoded = await decodeSession(await encodeSession(artistPayload));
    expect(decoded?.artistId).toBe("artist_1");
    expect(sessionPayloadToUser(decoded!).artistId).toBe("artist_1");
  });
});

describe("session key derivation", () => {
  it("still decodes a cookie minted with the original node:crypto HKDF key", async () => {
    // The key moved to WebCrypto so middleware can run it on the Edge; a
    // cookie already in a browser must keep working across that change.
    const legacyKey = new Uint8Array(
      hkdfSync(
        "sha256",
        SECRET,
        new Uint8Array(0),
        "bb_session_enc_key_v1",
        32,
      ),
    );
    const legacy = await new EncryptJWT({
      email: payload.email,
      role: payload.role,
      displayName: payload.displayName,
      artistId: null,
    })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime("1h")
      .encrypt(legacyKey);
    expect((await decodeSession(legacy))?.sub).toBe("user_123");
  });
});

describe("renewSessionToken (sliding renewal)", () => {
  const DAY = 60 * 60 * 24;
  const POLICY = { ttlSeconds: 30 * DAY, renewWithinSeconds: 15 * DAY };
  const T0 = new Date("2026-11-01T09:00:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  async function mintAt(at: Date): Promise<string> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    const token = await encodeSession(payload, POLICY.ttlSeconds);
    return token;
  }

  it("does nothing while more than the renewal window is left (no write per request)", async () => {
    const token = await mintAt(T0);
    vi.setSystemTime(new Date(T0.getTime() + 10 * DAY * 1000));
    expect(await renewSessionToken(token, POLICY)).toBeNull();
  });

  it("re-issues a full-length session once under the window", async () => {
    const token = await mintAt(T0);
    const day20 = new Date(T0.getTime() + 20 * DAY * 1000);
    vi.setSystemTime(day20);
    const renewed = await renewSessionToken(token, POLICY);
    expect(renewed).toBeTruthy();
    expect(await decodeSession(renewed!)).toMatchObject({
      sub: "user_123",
      email: "owner@example.com",
      role: "OWNER",
    });
    // The renewed cookie outlives the original: still valid on day 45, when
    // the original 30-day session would long have expired.
    vi.setSystemTime(new Date(T0.getTime() + 45 * DAY * 1000));
    expect(await decodeSession(token)).toBeNull();
    expect(await decodeSession(renewed!)).not.toBeNull();
    // ...and it is not renewed again straight away.
    vi.setSystemTime(day20);
    expect(await renewSessionToken(renewed!, POLICY)).toBeNull();
  });

  it("never revives an expired session", async () => {
    const token = await mintAt(T0);
    vi.setSystemTime(new Date(T0.getTime() + 31 * DAY * 1000));
    expect(await renewSessionToken(token, POLICY)).toBeNull();
  });

  it("returns null (never throws) for garbage or a missing secret", async () => {
    expect(await renewSessionToken("garbage", POLICY)).toBeNull();
    const token = await mintAt(T0);
    vi.setSystemTime(new Date(T0.getTime() + 20 * DAY * 1000));
    delete process.env.SESSION_SECRET;
    try {
      expect(await renewSessionToken(token, POLICY)).toBeNull();
    } finally {
      process.env.SESSION_SECRET = SECRET;
    }
  });
});
