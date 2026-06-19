import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config/CLI. Load it ourselves so
// DATABASE_URL is available to migrate/introspect/seed commands. The .env lives
// at the repo root (two levels up from packages/core).
const repoRoot = path.resolve(__dirname, "..", "..");
for (const candidate of [
  path.join(process.cwd(), ".env"),
  path.join(repoRoot, ".env"),
]) {
  try {
    process.loadEnvFile(candidate);
    break;
  } catch {
    // .env is optional (e.g. CI provides env vars directly).
  }
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
