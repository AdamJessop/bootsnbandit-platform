import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { Nav } from "./Nav";

describe("Nav branding", () => {
  it("renders the bb-logo image in the brand link", () => {
    const html = renderToStaticMarkup(<Nav />);
    expect(html).toContain("/bb-logo.png");
    expect(html).toContain("Boots");
  });
});
