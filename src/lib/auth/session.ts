import { hkdfSync } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import type { SessionRole, SessionUser } from "./index";

/**
 * Encrypted (JWE) session token, keyed by SESSION_SECRET. We use `dir` + A256GCM
 * so the cookie payload is both signed and encrypted (opaque to the client).
 * The 32-byte content-encryption key is derived from SESSION_SECRET via HKDF so
 * any secret length works.
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

function deriveKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (need 16+ chars)");
  }
  // HKDF-SHA256 -> 256-bit AES key; salt empty, info pins the usage/version.
  const derived = hkdfSync(
    "sha256",
    secret,
    new Uint8Array(0),
    "bb_session_enc_key_v1",
    32,
  );
  return new Uint8Array(derived);
}

export async function encodeSession(
  payload: SessionPayload,
  ttlSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const key = deriveKey();
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
  try {
    const key = deriveKey();
    const { payload } = await jwtDecrypt(token, key);
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
  } catch {
    return null;
  }
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
