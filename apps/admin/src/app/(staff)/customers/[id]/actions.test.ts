import { describe, expect, it } from "vitest";
import { validateManualEmail, validateNotes } from "./action-helpers";

/**
 * actions.ts is a "use server" module (requireRole/prisma/sendEmail —
 * server-only, not importable under vitest). Its behaviour is the pure
 * validators below + the domain services; the DB/email side-effects are
 * covered by the build and manual QA.
 */
describe("customer actions input contracts", () => {
  it("rejects an empty manual email", () => {
    expect(validateManualEmail({ subject: "", body: "" }).ok).toBe(false);
  });

  it("normalises a notes patch", () => {
    expect(validateNotes({ notes: " x ", marketingConsent: true })).toEqual({
      notes: "x",
      marketingConsent: true,
    });
  });
});
