import path from "node:path";
import { defineConfig } from "vitest/config";

// Load .env so integration tests can reach the dockerised Postgres.
// Optional: tests skip gracefully when DATABASE_URL is absent/unreachable.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env may not exist (CI provides env vars directly) — ignore.
}

const coreSrc = path.resolve(__dirname, "packages/core/src");

export default defineConfig({
  test: {
    environment: "node",
    // Domain tests now live in @bnb/core; the root app keeps its own. A single
    // root run aggregates both suites (≥483 total) until P2/P3 split them.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "packages/core/src/**/*.{test,spec}.{ts,tsx}",
    ],
    // Several integration suites write to the shared dockerised Postgres
    // (Artist/Booking/etc.). Running test files serially (no cross-file
    // parallelism) keeps those writes from racing the exact-count assertions
    // in seed-counts.test.ts. Within-file tests still run normally.
    fileParallelism: false,
  },
  // tsconfig uses `jsx: preserve` (Next handles JSX at build time); override it
  // for tests so Vite's oxc transformer compiles JSX via the automatic React
  // runtime (Vite 8 uses oxc; the legacy `esbuild` key is deprecated).
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  resolve: {
    // Order matters: more specific @bnb/core subpaths before the catch-all so
    // `@bnb/core/db` → db.ts (not db/) and `@bnb/core/services` → its index.
    alias: [
      { find: /^@bnb\/core\/db$/, replacement: path.join(coreSrc, "db.ts") },
      { find: /^@bnb\/core\/services$/, replacement: path.join(coreSrc, "services/index.ts") },
      { find: /^@bnb\/core\/auth$/, replacement: path.join(coreSrc, "auth/index.ts") },
      { find: /^@bnb\/core\/email$/, replacement: path.join(coreSrc, "email/index.ts") },
      { find: /^@bnb\/core\/cron$/, replacement: path.join(coreSrc, "cron/index.ts") },
      { find: /^@bnb\/core\/http$/, replacement: path.join(coreSrc, "http/index.ts") },
      { find: /^@bnb\/core\/(.*)$/, replacement: path.join(coreSrc, "$1") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
