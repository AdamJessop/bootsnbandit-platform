import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { Customer } from "@prisma/client";
import { prisma } from "@bnb/core/db";

/**
 * Customer credential service: scrypt password hashing (no new dependency) and
 * the one-time set-password (account activation) token lifecycle. Tokens live
 * in CustomerPasswordToken, expire after 30 days, and an expired redemption
 * reports the customerId so the caller can mint + email a fresh link.
 */

export const SET_PASSWORD_TOKEN_TTL_DAYS = 30;

const SCRYPT_COST = 16384; // N
const KEY_LEN = 64;
const SALT_LEN = 16;

// Hand-rolled promise wrapper: promisify() drops the 4-arg (options) overload
// of crypto.scrypt under strict cross-project compilation.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Hash a password as `scrypt$<saltB64url>$<hashB64url>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(password, salt, KEY_LEN, { N: SCRYPT_COST });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Constant-time verify against a stored `scrypt$…` hash. Never throws. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = await scrypt(password, salt, expected.length, {
      N: SCRYPT_COST,
    });
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

/** Mint a 30-day set-password token for a customer and return it. */
export async function mintSetPasswordToken(
  customerId: string,
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.customerPasswordToken.create({
    data: {
      customerId,
      token,
      expiresAt: new Date(
        Date.now() + SET_PASSWORD_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
      ),
    },
  });
  return token;
}

export type RedeemResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: "expired"; customerId: string }
  | { ok: false; reason: "invalid" };

/**
 * Redeem a set-password token: writes the password hash, marks the token
 * redeemed and invalidates the customer's other outstanding tokens. An expired
 * (but otherwise valid, unredeemed) token returns its customerId so the caller
 * can reissue a fresh link.
 */
export async function redeemSetPasswordToken(
  token: string,
  newPassword: string,
): Promise<RedeemResult> {
  const row = await prisma.customerPasswordToken.findUnique({
    where: { token },
  });
  if (!row || row.redeemedAt) return { ok: false, reason: "invalid" };
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired", customerId: row.customerId };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: row.customerId },
      data: { passwordHash },
    }),
    prisma.customerPasswordToken.update({
      where: { id: row.id },
      data: { redeemedAt: new Date() },
    }),
    // Invalidate any other live tokens for this customer.
    prisma.customerPasswordToken.deleteMany({
      where: {
        customerId: row.customerId,
        id: { not: row.id },
        redeemedAt: null,
      },
    }),
  ]);
  return { ok: true, customerId: row.customerId };
}

/**
 * Email + password sign-in. Emails are not unique on Customer, so the newest
 * record with a credential wins; credential-less records never match. The
 * lookup is case-insensitive (welcome emails may have stored mixed casing).
 */
export async function signInCustomer(
  email: string,
  password: string,
): Promise<Customer | null> {
  const customer = await prisma.customer.findFirst({
    where: {
      email: { equals: email.trim(), mode: "insensitive" },
      passwordHash: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!customer?.passwordHash) return null;
  const ok = await verifyPassword(password, customer.passwordHash);
  return ok ? customer : null;
}
