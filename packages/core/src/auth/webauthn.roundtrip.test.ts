/**
 * Proves a full passkey register -> login round-trip against the REAL
 * @simplewebauthn/server verifiers, using an in-process software authenticator.
 * No DB, no browser — just the cryptographic ceremony the route handlers wrap.
 */
import { describe, it, expect } from "vitest";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  createSoftCredential,
  buildRegistrationResponse,
  buildAuthenticationResponse,
} from "./__fixtures__/softAuthenticator";

const rpID = "localhost";
const origin = "http://localhost:3000";

describe("passkey register -> login round-trip", () => {
  it("registers a credential then authenticates with it", async () => {
    // --- Registration ceremony ---
    const regOptions = await generateRegistrationOptions({
      rpName: "Boots 'n' Bandit",
      rpID,
      userName: "owner@example.com",
      userDisplayName: "Studio Owner",
      attestationType: "none",
    });

    const cred = await createSoftCredential(rpID);
    const regResponse = buildRegistrationResponse(
      cred,
      regOptions.challenge,
      origin,
    );

    const regVerification = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: regResponse as any,
      expectedChallenge: regOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    expect(regVerification.verified).toBe(true);
    const info = regVerification.registrationInfo!;
    expect(info.credential.counter).toBe(0);

    // Persisted credential shape (what route handlers store on Authenticator).
    const stored = {
      credentialID: info.credential.id,
      publicKey: info.credential.publicKey,
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
    };
    expect(stored.credentialID).toBe(
      isoBase64URL.fromBuffer(cred.credentialID),
    );

    // --- Authentication ceremony ---
    const authOptions = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{ id: stored.credentialID }],
    });

    const authResponse = await buildAuthenticationResponse(
      cred,
      authOptions.challenge,
      origin,
    );

    const authVerification = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: authResponse as any,
      expectedChallenge: authOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: stored.credentialID,
        publicKey: stored.publicKey,
        counter: stored.counter,
        transports: stored.transports,
      },
    });

    expect(authVerification.verified).toBe(true);
    // Counter must advance (replay protection).
    expect(authVerification.authenticationInfo.newCounter).toBeGreaterThan(
      stored.counter,
    );
  });

  it("rejects an assertion replayed with a stale challenge", async () => {
    const cred = await createSoftCredential(rpID);
    const regOptions = await generateRegistrationOptions({
      rpName: "Boots 'n' Bandit",
      rpID,
      userName: "a@example.com",
      attestationType: "none",
    });
    const regResponse = buildRegistrationResponse(
      cred,
      regOptions.challenge,
      origin,
    );
    const reg = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: regResponse as any,
      expectedChallenge: regOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    const stored = reg.registrationInfo!.credential;

    const authResponse = await buildAuthenticationResponse(
      cred,
      "the-real-challenge",
      origin,
    );
    await expect(
      verifyAuthenticationResponse({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: authResponse as any,
        expectedChallenge: "a-different-challenge",
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.id,
          publicKey: stored.publicKey,
          counter: stored.counter,
        },
      }),
    ).rejects.toThrow();
  });
});
