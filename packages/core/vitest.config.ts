import path from "node:path";
import { defineConfig } from "vitest/config";

// Load the repo-root .env so integration tests can reach the dockerised
// Postgres. Tests skip gracefully when DATABASE_URL is absent/unreachable.
try {
  process.loadEnvFile(path.resolve(__dirname, "..", "..", ".env"));
} catch {
  // .env may not exist (CI provides env vars directly) — ignore.
}

const coreSrc = path.resolve(__dirname, "src");

export default defineConfig({
  test: {
    environment: "node",
    // The shared domain layer's own suites (db/services/auth/email/cron/...).
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration suites write to the shared dockerised Postgres; serial file
    // execution keeps those writes from racing the exact-count assertions in
    // seed-counts.test.ts. Within-file tests still run normally.
    fileParallelism: false,
  },
  // The package ships .ts/.tsx source (no jsx pragma); compile JSX via the
  // automatic React runtime for tests (Vite 8 uses oxc).
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  resolve: {
    // Resolve @bnb/core subpaths to this package's TS source so tests that
    // import via the public package specifier match runtime resolution. Order:
    // specific subpaths before the catch-all so `@bnb/core/db` → db.ts etc.
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
    ],
  },
});
