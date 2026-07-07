/**
 * Tiny in-memory sliding-window rate limiter for the public POST routes.
 *
 * Deliberately process-local (per server instance) — the goal is stopping
 * casual abuse from burning the Resend quota, not distributed enforcement.
 * The clock is injectable so the window logic unit-tests without timers.
 */

export interface RateLimitOptions {
  /** Max allowed hits per key within the window. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
}

export interface RateLimiter {
  /**
   * Record a hit for `key`. Returns true when the hit is allowed, false when
   * the key has exhausted its window. `now` defaults to Date.now().
   */
  hit(key: string, now?: number): boolean;
}

export function createRateLimiter({
  limit,
  windowMs,
}: RateLimitOptions): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

/**
 * Best-effort client key for rate limiting: the first `x-forwarded-for` hop
 * (set by the proxy in front of the app), then `x-real-ip`, then "unknown".
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || "unknown";
}
