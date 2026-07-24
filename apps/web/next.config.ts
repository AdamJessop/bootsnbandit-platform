import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Standalone output for Docker: `next build` emits .next/standalone with
  // server.js + only the traced files needed at runtime. `next dev` ignores it.
  output: "standalone",
  // @bnb/core ships TypeScript source via its exports map; Next must transpile
  // the workspace package rather than treat it as pre-compiled JS.
  transpilePackages: ["@bnb/core"],
  // File tracing must span the monorepo root so the app can trace files it
  // imports from packages/core (otherwise Next infers the app dir as root).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
