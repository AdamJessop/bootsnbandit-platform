import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({ linkIdentityAction: vi.fn() }));

import { LinkIdentityCard } from "./LinkIdentityCard";

describe("LinkIdentityCard", () => {
  it("lists the handles by name and channel", () => {
    const html = renderToStaticMarkup(
      <LinkIdentityCard
        customerId="c1"
        identities={[
          { id: "i1", channel: "instagram", label: "amy.ink · Instagram" },
        ]}
      />,
    );
    expect(html).toContain("amy.ink · Instagram");
    expect(html).toContain("Link handle");
  });

  it("explains itself when there is nothing to link", () => {
    const html = renderToStaticMarkup(
      <LinkIdentityCard customerId="c1" identities={[]} />,
    );
    expect(html).toContain("No linkable handles");
  });
});
