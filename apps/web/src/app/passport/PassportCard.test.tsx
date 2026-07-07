import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./passport.module.css", () => ({ default: {} }));

import { PassportCard } from "./PassportCard";

describe("PassportCard", () => {
  it("renders holder, level and the filled/empty stamp split", () => {
    const html = renderToStaticMarkup(
      <PassportCard
        holder="A. Collector"
        level="Level 2 · Outlaw"
        filled={4}
        total={8}
      />,
    );
    expect(html).toContain("BANDIT PASS");
    expect(html).toContain("A. Collector");
    expect(html).toContain("Level 2 · Outlaw");
    expect(html).toContain("4/8");
  });
});
