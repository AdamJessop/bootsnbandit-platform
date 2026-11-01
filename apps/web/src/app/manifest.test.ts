import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("public web manifest", () => {
  it("names the studio and starts at the home page", () => {
    const m = manifest();
    expect(m.name).toContain("Boots 'n' Bandit");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("only references icons that exist in public/icons", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(
        existsSync(path.join(__dirname, "..", "..", "public", icon.src)),
      ).toBe(true);
    }
  });
});
