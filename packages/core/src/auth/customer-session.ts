import { hkdfSync } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

/**
 * Customer (public-site) session — an encrypted JWE cookie mirroring the staff
 * session in ./session.ts but with its OWN HKDF info string, so staff and
 * customer tokens are mutually undecryptable even though both derive from
 * SESSION_SECRET. The cookie is host-only on the web origin and deliberately
 * named differently from the staff cookie (P4 isolation).
 */

export const CUSTOMER_COOKIE = "bb_customer_session";

export interface CustomerSessionPayload {
  /** Customer id. */
  sub: string;
  email: string;
  name: string;
}

const ALG = "dir";
const ENC = "A256GCM";

function deriveKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (need 16+ chars)");
  }
  const derived = hkdfSync(
    "sha256",
    secret,
    new Uint8Array(0),
    "bb_customer_session_v1",
    32,
  );
  return new Uint8Array(derived);
}

export async function encodeCustomerSession(
  payload: CustomerSessionPayload,
  ttlSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const key = deriveKey();
  return new EncryptJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(key);
}

export async function decodeCustomerSession(
  token: string,
): Promise<CustomerSessionPayload | null> {
  try {
    const key = deriveKey();
    const { payload } = await jwtDecrypt(token, key);
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return { sub: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
