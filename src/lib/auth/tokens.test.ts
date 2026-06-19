import { describe, it, expect } from "vitest";
import { generateToken } from "./tokens";

describe("generateToken", () => {
  it("produces a url-safe, high-entropy token", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(32);
  });

  it("is unique across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateToken());
    expect(seen.size).toBe(1000);
  });

  it("honours a requested byte length", () => {
    const short = generateToken(16);
    const long = generateToken(48);
    expect(long.length).toBeGreaterThan(short.length);
  });
});
