import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root: a parent-dir yarn.lock otherwise confuses
  // Next's lockfile inference. This repo's lockfile is package-lock.json.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
