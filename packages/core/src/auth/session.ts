import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import type { SessionRole, SessionUser } from "./index";

/**
 * Encrypted (JWE) session token, keyed by SESSION_SECRET. We use `dir` + A256GCM
 * so the cookie payload is both signed and encrypted (opaque to the client).
 * The 32-byte content-encryption key is derived from SESSION_SECRET via HKDF so
 * any secret length works.
 *
 * Key derivation uses WebCrypto (not `node:crypto`) so this module also runs in
 * Edge middleware, which renews sessions (see `renewSessionToken`). The output
 * is byte-identical to the previous `hkdfSync` derivation, so existing cookies
 * keep decoding.
 */
export interface SessionPayload {
  sub: string;
  email: string;
  role: SessionRole;
  displayName: string;
  artistId?: string | null;
}

const ALG = "dir";
const ENC = "A256GCM";

const KEY_INFO = "bb_session_enc_key_v1";

async function deriveKey(): Promise<Uint8Array> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (need 16+ chars)");
  }
  // HKDF-SHA256 -> 256-bit AES key; salt empty, info pins the usage/version.
  const enc = new TextEncoder();
  const ikm = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: enc.encode(KEY_INFO),
    },
    ikm,
    256,
  );
  return new Uint8Array(bits);
}

export async function encodeSession(
  payload: SessionPayload,
  ttlSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const key = await deriveKey();
  return new EncryptJWT({
    email: payload.email,
    role: payload.role,
    displayName: payload.displayName,
    artistId: payload.artistId ?? null,
  })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(key);
}

export async function decodeSession(
  token: string,
): Promise<SessionPayload | null> {
  return (await decryptSession(token))?.payload ?? null;
}

/** Decrypt + shape-check a token, keeping its `exp` (seconds since epoch). */
async function decryptSession(
  token: string,
): Promise<{ payload: SessionPayload; exp: number | null } | null> {
  try {
    const key = await deriveKey();
    const { payload } = await jwtDecrypt(token, key);
    const shaped = shapePayload(payload);
    if (!shaped) return null;
    return { payload: shaped, exp: payload.exp ?? null };
  } catch {
    return null;
  }
}

function shapePayload(payload: JWTPayload): SessionPayload | null {
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    (payload.role !== "OWNER" && payload.role !== "ARTIST") ||
    typeof payload.displayName !== "string"
  ) {
    return null;
  }
  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role as SessionRole,
    displayName: payload.displayName,
    artistId: (payload.artistId as string | null | undefined) ?? null,
  };
}

/**
 * Sliding session renewal. Returns a fresh token (full `ttlSeconds` again) when
 * `token` is valid but has less than `renewWithinSeconds` left, otherwise null
 * (nothing to do — or the token is invalid/expired, which the auth guards deal
 * with). Called from middleware on each request, so it is decrypt-only in the
 * common case: a cookie is re-written at most about once per
 * `ttlSeconds - renewWithinSeconds`, never on every request. Never throws.
 *
 * Role / artist link in the payload are not refreshed here: `getCurrentUser`
 * reads those from the DB on every request, so the payload is identity only.
 */
export async function renewSessionToken(
  token: string,
  { ttlSeconds, renewWithinSeconds }: SessionRenewalPolicy,
): Promise<string | null> {
  try {
    const decoded = await decryptSession(token);
    if (!decoded || decoded.exp == null) return null;
    const remaining = decoded.exp - Math.floor(Date.now() / 1000);
    if (remaining >= renewWithinSeconds) return null;
    return await encodeSession(decoded.payload, ttlSeconds);
  } catch {
    return null;
  }
}

export interface SessionRenewalPolicy {
  ttlSeconds: number;
  renewWithinSeconds: number;
}

export function sessionPayloadToUser(payload: SessionPayload): SessionUser {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    displayName: payload.displayName,
    artistId: payload.artistId ?? null,
  };
}
