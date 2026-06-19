/**
 * Pure mirror of the service-worker caching decisions in public/sw.js. Kept in
 * src so the routing logic is unit-tested in the Node test env (the SW itself
 * needs a ServiceWorker global scope and cannot run here). If you change one,
 * change the other.
 */

export type CacheStrategy =
  | "passthrough"
  | "network-first"
  | "stale-while-revalidate";

export interface RequestLike {
  method: string;
  url: string;
  mode: string;
  /** The worker's own origin (self.location.origin). */
  origin: string;
}

export function cacheStrategyFor(req: RequestLike): CacheStrategy {
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== req.origin) return "passthrough";
  if (url.pathname.startsWith("/api/")) return "passthrough";
  if (req.mode === "navigate") return "network-first";
  return "stale-while-revalidate";
}
