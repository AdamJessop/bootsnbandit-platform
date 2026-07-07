import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Companion for public/sw.js (relocated from public/ so it is not deployed).
 *
 * The service worker runs only in a browser ServiceWorkerGlobalScope (it relies
 * on `self`, `caches`, and `FetchEvent`), so it cannot be imported into the
 * Node/vitest environment. Its registration glue and caching strategy are
 * unit-tested in src instead:
 *   - src/app/layout.test.tsx (the root layout registers the worker inline)
 *   - src/lib/pwa/sw-strategy.test.ts (cache-decision predicate mirror)
 *
 * Here we assert the deployed worker source keeps the load-bearing markers the
 * mirrored strategy assumes.
 */

const sw = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "public", "sw.js"),
  "utf8",
);

describe("public/sw.js source", () => {
  it("registers install, activate and fetch handlers", () => {
    for (const evt of ["install", "activate", "fetch"]) {
      expect(sw).toContain(`self.addEventListener("${evt}"`);
    }
  });

  it("never caches API routes (writes/auth stay network-only)", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
  });

  it("precaches the offline shell", () => {
    expect(sw).toContain('"/manifest.webmanifest"');
  });
});
