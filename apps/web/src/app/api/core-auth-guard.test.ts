import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guard: the public web app must never import the core auth subpath. The
 * staff session cookie is host-only on the admin subdomain, so any auth-gated
 * code shipped here could never authenticate in prod — it would just leak
 * staff surface (and a /sign-in redirect web doesn't have) onto the public
 * origin.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("public origin auth guard", () => {
  it("no file under apps/web/src imports the core auth subpath", () => {
    // Built dynamically so this guard file never matches itself.
    const needle = ["@bnb", "core", "auth"].join("/");
    const files = collectSourceFiles(SRC_ROOT);
    expect(files.length).toBeGreaterThan(50); // sanity: the glob found the app
    const offenders = files.filter((f) =>
      readFileSync(f, "utf8").includes(needle),
    );
    expect(offenders).toEqual([]);
  });
});
