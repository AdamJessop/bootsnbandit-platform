import { describe, expect, it } from "vitest";
import { buildConvertInput, validateReply } from "./enquiry-helpers";

/**
 * actions.ts is "use server" (requireRole/prisma/services/email — server-only,
 * not importable under vitest). Its input contracts are the pure helpers below;
 * DB/email side-effects are covered by the build + manual QA.
 */
describe("enquiry actions input contracts", () => {
  it("rejects an empty reply", () => {
    expect(validateReply({ message: "" }).ok).toBe(false);
  });

  it("builds a pending booking on convert", () => {
    const r = buildConvertInput({
      customerId: "c1",
      artistId: "a1",
      startISO: "2026-07-01T10:00:00Z",
      durationMin: 60,
      type: "consult",
    });
    expect(r.ok).toBe(true);
  });
});
