import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Symmetric encryption for credentials we must be able to USE again — today
 * only `ChannelConnection.accessToken` (a Meta page token). Hashing is not an
 * option: we have to present the token to Graph.
 *
 * AES-256-GCM, because it authenticates as well as encrypts: a tampered row
 * fails to decrypt instead of yielding a plausible-looking wrong token. The
 * key is HKDF-SHA256 over SESSION_SECRET with a channel-specific salt and
 * info, so it is cryptographically unrelated to the session-cookie key
 * derived in auth/session.ts even though both come from the same secret.
 *
 * Envelope: `v1:<iv b64>:<tag b64>:<ciphertext b64>` — versioned so a future
 * scheme can be introduced without having to guess at old rows.
 *
 * node:crypto only. No new dependency, and nothing here touches the database.
 */

export const SECRET_ENVELOPE_VERSION = "v1";

/**
 * 32 chars, deliberately stricter than auth/session.ts's 16. A session cookie
 * is short-lived and revocable; a page token is a long-lived credential to
 * someone else's inbox and is not worth protecting with a weak key.
 */
export const MIN_SESSION_SECRET_CHARS = 32;

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT = "bnb-channel-token";
const INFO = "ChannelConnection.accessToken";

/** SESSION_SECRET is missing or too weak — a configuration fault, not a bug. */
export class SecretConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretConfigError";
  }
}

function deriveKey(env: NodeJS.ProcessEnv): Buffer {
  const secret = env.SESSION_SECRET?.trim();
  if (!secret || secret.length < MIN_SESSION_SECRET_CHARS) {
    throw new SecretConfigError(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_CHARS} characters to store channel tokens.`,
    );
  }
  return Buffer.from(hkdfSync("sha256", secret, SALT, INFO, 32));
}

export function encryptSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = deriveKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    SECRET_ENVELOPE_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(
  envelope: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== SECRET_ENVELOPE_VERSION) {
    throw new Error("Unrecognised secret envelope");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed secret envelope");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(env), iv);
  decipher.setAuthTag(tag);
  // .final() throws when the tag does not verify, so a tampered row or a
  // rotated secret fails loudly rather than returning a wrong token.
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Cheap shape check — does NOT prove the envelope decrypts. */
export function isEncryptedSecret(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 4 && parts[0] === SECRET_ENVELOPE_VERSION;
}
