import path from "node:path";
import { defineConfig } from "vitest/config";

// Load the repo-root .env so integration tests can reach the dockerised
// Postgres. Tests skip gracefully when DATABASE_URL is absent/unreachable.
try {
  process.loadEnvFile(path.resolve(__dirname, "..", "..", ".env"));
} catch {
  // .env may not exist (CI provides env vars directly) — ignore.
}

const coreSrc = path.resolve(__dirname, "..", "..", "packages/core/src");

export default defineConfig({
  test: {
    environment: "node",
    // Only this app's suites: the moved (site) pages + public API routes.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Public-API integration suites write to the shared dockerised Postgres;
    // serial file execution keeps those writes from racing exact-count asserts.
    fileParallelism: false,
  },
  // tsconfig uses `jsx: preserve` (Next handles JSX at build); override for
  // tests so Vite's oxc transformer compiles JSX via the automatic runtime.
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  resolve: {
    // Resolve @bnb/core subpaths to the core TS source (its exports map points
    // at .ts which Vite reads directly). Order: specific subpaths before the
    // catch-all so `@bnb/core/db` → db.ts, `@bnb/core/services` → its index.
    alias: [
      { find: /^@bnb\/core\/db$/, replacement: path.join(coreSrc, "db.ts") },
      {
        find: /^@bnb\/core\/services$/,
        replacement: path.join(coreSrc, "services/index.ts"),
      },
      {
        find: /^@bnb\/core\/auth$/,
        replacement: path.join(coreSrc, "auth/index.ts"),
      },
      {
        find: /^@bnb\/core\/email$/,
        replacement: path.join(coreSrc, "email/index.ts"),
      },
      {
        find: /^@bnb\/core\/cron$/,
        replacement: path.join(coreSrc, "cron/index.ts"),
      },
      {
        find: /^@bnb\/core\/http$/,
        replacement: path.join(coreSrc, "http/index.ts"),
      },
      { find: /^@bnb\/core\/(.*)$/, replacement: path.join(coreSrc, "$1") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
