import { randomBytes } from "node:crypto";

/**
 * Cryptographically-random, URL-safe token for invites and calendar feeds.
 * base64url -> safe in URLs and `Set-Cookie` without escaping.
 *
 * @param bytes entropy in bytes (default 32 -> 256 bits)
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
