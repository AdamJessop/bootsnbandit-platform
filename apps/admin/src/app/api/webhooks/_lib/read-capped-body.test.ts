import { describe, expect, it } from "vitest";
import { MAX_WEBHOOK_BODY_BYTES, readCappedBody } from "./read-capped-body";

/**
 * The one body reader both unauthenticated webhook routes use. Its whole job
 * is the cap, so that is what is pinned here.
 */
function post(body: BodyInit | null): Request {
  return new Request("http://admin.test/api/webhooks/x", {
    method: "POST",
    ...(body === null ? {} : { body }),
  });
}

describe("readCappedBody", () => {
  it("decodes the body exactly once, as UTF-8", async () => {
    // A multi-byte character proves the decode is not per-chunk byte slicing.
    expect(await readCappedBody(post('{"note":"café ✅"}'))).toBe(
      '{"note":"café ✅"}',
    );
  });

  it("is an empty string for a request with no body at all", async () => {
    expect(await readCappedBody(post(null))).toBe("");
  });

  it("returns null past the cap rather than buffering the flood", async () => {
    expect(await readCappedBody(post("x".repeat(64)), 32)).toBeNull();
    expect(await readCappedBody(post("x".repeat(32)), 32)).toBe("x".repeat(32));
  });

  it("defaults to the 1 MiB cap both routes advertise", () => {
    expect(MAX_WEBHOOK_BODY_BYTES).toBe(1_048_576);
  });
});
