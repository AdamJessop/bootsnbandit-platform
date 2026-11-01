/**
 * Brute-force brake for the kiosk staff PIN. A 4-digit PIN is only 10,000
 * guesses, so after `maxAttempts` wrong tries in a row further attempts are
 * refused for `lockoutMs`. Per server process and in memory — the studio has
 * one kiosk, and a restart clearing it is acceptable; the point is to make
 * standing at the tablet guessing impractical, not to be a distributed rate
 * limiter.
 */
export class PinThrottle {
  private failures = 0;
  private lockedUntil = 0;

  constructor(
    private readonly maxAttempts = 5,
    private readonly lockoutMs = 60_000,
  ) {}

  /** Seconds until attempts are allowed again, or 0 when they are. */
  lockedFor(now: number = Date.now()): number {
    return now < this.lockedUntil
      ? Math.ceil((this.lockedUntil - now) / 1000)
      : 0;
  }

  recordFailure(now: number = Date.now()): void {
    this.failures += 1;
    if (this.failures >= this.maxAttempts) {
      this.failures = 0;
      this.lockedUntil = now + this.lockoutMs;
    }
  }

  reset(): void {
    this.failures = 0;
    this.lockedUntil = 0;
  }
}

export const pinThrottle = new PinThrottle();
