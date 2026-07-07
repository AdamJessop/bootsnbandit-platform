import { describe, expect, it } from "vitest";
import { validateManualEmail, validateNotes } from "./action-helpers";

/**
 * The server actions in actions.ts call requireRole/prisma/sendEmail (all
 * server-only, not importable under vitest). Their pure input validation lives
 * in action-helpers.ts and is asserted here; the DB/email side-effects are
 * covered by the build + manual QA.
 */
describe("validateManualEmail", () => {
  it("requires a subject and body", () => {
    expect(validateManualEmail({ subject: "", body: "hi" }).ok).toBe(false);
    expect(validateManualEmail({ subject: "Hi", body: "  " }).ok).toBe(false);
  });

  it("accepts a complete message", () => {
    const r = validateManualEmail({ subject: "Hi", body: "Your appointment" });
    expect(r).toEqual({ ok: true, subject: "Hi", body: "Your appointment" });
  });
});

describe("validateNotes", () => {
  it("trims and accepts notes + consent", () => {
    expect(validateNotes({ notes: "  vip  ", marketingConsent: true })).toEqual(
      {
        notes: "vip",
        marketingConsent: true,
      },
    );
  });

  it("normalises empty notes to null", () => {
    expect(validateNotes({ notes: "", marketingConsent: false })).toEqual({
      notes: null,
      marketingConsent: false,
    });
  });
});
