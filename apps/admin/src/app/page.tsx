import { cn } from "@bnb/core/utils";
// Prove cross-package resolution through transpilePackages at BUILD time:
//  - cn (domain util),
//  - the Prisma-backed db singleton (runtime value → exercises @prisma/client),
//  - getCurrentUser (carries `import "server-only"`).
// Referenced without issuing a query so the placeholder renders without a live
// DB, while the bundler still pulls + transpiles the workspace package.
import { prisma } from "@bnb/core/db";
import { getCurrentUser } from "@bnb/core/auth";

export default function Home() {
  const resolved = typeof prisma === "object" && typeof getCurrentUser === "function";
  return (
    <main className={cn("min-h-dvh", "grid", "place-items-center")}>
      <h1>Boots &apos;n&apos; Bandit — admin shell (Phase 1)</h1>
      <p>core wired: {String(resolved)}</p>
    </main>
  );
}
