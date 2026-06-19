import { describe, expect, it } from "vitest";
import { validateManualEmail, validateNotes } from "./action-helpers";

/**
 * CustomerActions imports the "use server" actions module (server-only, not
 * importable under vitest), so we assert the pure validators it relies on
 * rather than importing the component. Rendering is covered by the build.
 */
describe("CustomerActions validators", () => {
  it("blocks an incomplete email", () => {
    expect(validateManualEmail({ subject: "Hi", body: "" }).ok).toBe(false);
  });

  it("keeps consent in the notes patch", () => {
    expect(
      validateNotes({ notes: "x", marketingConsent: true }).marketingConsent,
    ).toBe(true);
  });
});
