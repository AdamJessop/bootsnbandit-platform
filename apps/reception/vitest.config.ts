import path from "node:path";
import { defineConfig } from "vitest/config";

// Load the monorepo-root .env so integration tests can reach the dockerised
// Postgres. Optional: tests skip gracefully when DATABASE_URL is absent.
try {
  process.loadEnvFile(path.join(__dirname, "..", "..", ".env"));
} catch {
  // .env may not exist (CI provides env vars directly) — ignore.
}

const coreSrc = path.resolve(__dirname, "..", "..", "packages/core/src");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration suites write to the shared dockerised Postgres; serialise
    // files so those writes don't race exact-count assertions.
    fileParallelism: false,
  },
  // tsconfig uses `jsx: preserve`; override for tests so Vite's oxc transformer
  // compiles JSX via the automatic React runtime.
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  resolve: {
    // Order matters: specific @bnb/core subpaths before the catch-all so
    // `@bnb/core/db` → db.ts (not db/) and `@bnb/core/services` → its index.
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
        find: /^@bnb\/core\/http$/,
        replacement: path.join(coreSrc, "http/index.ts"),
      },
      { find: /^@bnb\/core\/(.*)$/, replacement: path.join(coreSrc, "$1") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
