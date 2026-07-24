import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // @bnb/core ships TypeScript source via its exports map; Next must transpile
  // the workspace package rather than treat it as pre-compiled JS.
  transpilePackages: ["@bnb/core"],
  // File tracing must span the monorepo root so the app can trace files it
  // imports from packages/core (otherwise Next infers the app dir as root).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
