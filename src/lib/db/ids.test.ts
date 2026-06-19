import { describe, expect, it } from "vitest";
import { createId } from "./ids";

describe("createId", () => {
  it("returns a non-empty lower-case alphanumeric id", () => {
    const id = createId();
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(id.length).toBeGreaterThanOrEqual(20);
  });

  it("is highly likely to be unique across many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5000; i++) ids.add(createId());
    expect(ids.size).toBe(5000);
  });

  it("starts with 'c' (cuid-like shape)", () => {
    expect(createId().startsWith("c")).toBe(true);
  });
});
