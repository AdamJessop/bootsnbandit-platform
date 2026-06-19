import path from "node:path";
import { defineConfig } from "vitest/config";

// Load .env so integration tests can reach the dockerised Postgres.
// Optional: tests skip gracefully when DATABASE_URL is absent/unreachable.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env may not exist (CI provides env vars directly) — ignore.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
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
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
