import { describe, expect, it } from "vitest";
import { AddPasskeyButton } from "./AddPasskeyButton";

/**
 * The button drives the browser WebAuthn ceremony (@simplewebauthn/browser);
 * the enrolment flow itself (options → register → verify, error handling) is
 * pure and asserted in ../_lib/passkey.test.ts. Assert the module boundary.
 */
describe("AddPasskeyButton module", () => {
  it("exports the client component", () => {
    expect(typeof AddPasskeyButton).toBe("function");
  });
});
