import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  SecretConfigError,
  SECRET_ENVELOPE_VERSION,
} from "./secrets";

/**
 * Meta page tokens are long-lived credentials that can read and send a
 * studio's DMs. They are stored encrypted so a database dump — a backup, a
 * pg_dump pasted into a support ticket, a read replica — is not a set of live
 * tokens. The key comes from SESSION_SECRET, which the deployment already
 * treats as the crown jewel: one secret to rotate, not two.
 */
const ENV = {
  SESSION_SECRET: "0123456789abcdef0123456789abcdef0123456789",
} as NodeJS.ProcessEnv;

const TOKEN = "EAAG_synthetic_page_token_for_tests_only_0000";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token", () => {
    expect(decryptSecret(encryptSecret(TOKEN, ENV), ENV)).toBe(TOKEN);
  });

  it("never leaks the plaintext into the envelope", () => {
    const envelope = encryptSecret(TOKEN, ENV);
    expect(envelope).not.toContain(TOKEN);
    expect(envelope).not.toContain("synthetic");
  });

  it("uses a fresh IV every time, so the same token never encrypts alike", () => {
    expect(encryptSecret(TOKEN, ENV)).not.toBe(encryptSecret(TOKEN, ENV));
  });

  it("is a versioned four-part envelope", () => {
    const parts = encryptSecret(TOKEN, ENV).split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(SECRET_ENVELOPE_VERSION);
    expect(Buffer.from(parts[1], "base64")).toHaveLength(12); // IV
    expect(Buffer.from(parts[2], "base64")).toHaveLength(16); // GCM tag
  });

  it("refuses a tampered ciphertext instead of returning garbage", () => {
    const [v, iv, tag, ct] = encryptSecret(TOKEN, ENV).split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    expect(() =>
      decryptSecret(`${v}:${iv}:${tag}:${flipped.toString("base64")}`, ENV),
    ).toThrow();
  });

  it("refuses a malformed or unversioned envelope", () => {
    expect(() => decryptSecret("v1:only:three", ENV)).toThrow();
    expect(() => decryptSecret("v2:a:b:c", ENV)).toThrow();
  });

  it("refuses to encrypt under a short or absent SESSION_SECRET", () => {
    expect(() =>
      encryptSecret(TOKEN, { SESSION_SECRET: "tooshort" } as NodeJS.ProcessEnv),
    ).toThrow(SecretConfigError);
    expect(() => encryptSecret(TOKEN, {} as NodeJS.ProcessEnv)).toThrow(
      SecretConfigError,
    );
  });

  it("does not decrypt under a different secret", () => {
    const envelope = encryptSecret(TOKEN, ENV);
    expect(() =>
      decryptSecret(envelope, {
        SESSION_SECRET: "ffffffffffffffffffffffffffffffffffffffff",
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("recognises its own envelopes and nothing else", () => {
    expect(isEncryptedSecret(encryptSecret(TOKEN, ENV))).toBe(true);
    expect(isEncryptedSecret(TOKEN)).toBe(false);
    expect(isEncryptedSecret(null)).toBe(false);
    expect(isEncryptedSecret("v1:only:three")).toBe(false);
  });
});
