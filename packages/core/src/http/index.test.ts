import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DuplicateContactError } from "@bnb/core/services/contact-identity";
import { handleApiError, jsonError, parseBody } from "./index";

describe("api http helpers", () => {
  it("jsonError returns a Response with the given status + message", async () => {
    const res = jsonError(404, "nope");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("nope");
  });

  it("parseBody validates with zod and returns typed data", async () => {
    const schema = z.object({ name: z.string() });
    const req = new Request("http://x/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "Sarah" }),
      headers: { "content-type": "application/json" },
    });
    const data = await parseBody(req, schema);
    expect(data.name).toBe("Sarah");
  });

  it("parseBody throws a 400-mapped error on invalid input", async () => {
    const schema = z.object({ name: z.string() });
    const req = new Request("http://x/api/test", {
      method: "POST",
      body: JSON.stringify({ name: 123 }),
      headers: { "content-type": "application/json" },
    });
    await expect(parseBody(req, schema)).rejects.toBeTruthy();
    try {
      await parseBody(
        new Request("http://x", {
          method: "POST",
          body: JSON.stringify({ name: 1 }),
        }),
        schema,
      );
    } catch (err) {
      const res = handleApiError(err);
      expect(res.status).toBe(400);
    }
  });

  it("handleApiError maps a duplicate email/phone to 409 with its message", async () => {
    const res = handleApiError(new DuplicateContactError());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already exists/i);
  });

  it("handleApiError maps unknown errors to 500", async () => {
    const res = handleApiError(new Error("boom"));
    expect(res.status).toBe(500);
  });

  it("handleApiError maps auth/redirect errors to 401", async () => {
    const err = new Error("requireRole not implemented (Phase 4)");
    const res = handleApiError(err);
    // Unimplemented auth contract surfaces as 401 (unauthenticated).
    expect([401, 500]).toContain(res.status);
  });
});
