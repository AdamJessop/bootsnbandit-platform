import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config/CLI. Load it ourselves
// so DATABASE_URL is available to migrate/introspect/seed commands.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env is optional (e.g. CI provides env vars directly).
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
