import { describe, it, expect, beforeAll } from "vitest";
import {
  encodeSession,
  decodeSession,
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
