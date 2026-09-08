import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  linkIdentityAction: vi.fn(),
  loadLinkableIdentitiesAction: vi.fn(),
}));

import { IdentityPicker, LinkIdentityCard } from "./LinkIdentityCard";

describe("LinkIdentityCard", () => {
  it("opens on a button and asks for nothing until it is pressed", () => {
    // The list is a cross-customer scan. Running it on every owner render of
    // every customer — for a repair used a handful of times a year — is a
    // query nobody asked for; the button is the ask.
    const html = renderToStaticMarkup(<LinkIdentityCard customerId="c1" />);
    expect(html).toContain("Find a handle to link");
    // Nothing to choose from yet, so no picker and no link control.
    expect(html).not.toContain("Choose a handle");
    expect(html).not.toContain("Link handle");
  });

  it("says what it is for before anything is loaded", () => {
    const html = renderToStaticMarkup(<LinkIdentityCard customerId="c1" />);
    expect(html).toContain("Link a Messenger / Instagram handle");
  });
});

/** The second state: what the card swaps in once the owner has asked. */
describe("IdentityPicker", () => {
  it("lists the handles by name and channel", () => {
    const html = renderToStaticMarkup(
      <IdentityPicker
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
      <IdentityPicker customerId="c1" identities={[]} />,
    );
    expect(html).toContain("No linkable handles");
    expect(html).not.toContain("Link handle");
  });
});
