import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIdentityChips, IdentityChips } from "./IdentityChips";

describe("buildIdentityChips", () => {
  it("lists contact details then channel handles", () => {
    expect(
      buildIdentityChips({
        email: "amy@example.test",
        phone: "+447700900123",
        identities: [
          { channel: "instagram", displayName: "amy.ink" },
          { channel: "messenger", displayName: null },
        ],
      }),
    ).toEqual([
      { kind: "email", label: "amy@example.test" },
      { kind: "phone", label: "+447700900123" },
      { kind: "instagram", label: "amy.ink" },
      { kind: "messenger", label: "Linked account" },
    ]);
  });

  it("omits what the customer does not have", () => {
    expect(
      buildIdentityChips({ email: null, phone: null, identities: [] }),
    ).toEqual([]);
  });

  it("ignores a channel that is not a messaging handle", () => {
    // Defensive: MessageChannelKind also has web/email/note values, which are
    // never valid CustomerIdentity channels and must not become chips.
    expect(
      buildIdentityChips({
        email: null,
        phone: null,
        identities: [{ channel: "note", displayName: "nope" }],
      }),
    ).toEqual([]);
  });
});

describe("IdentityChips", () => {
  it("renders a chip per identity and nothing at all when empty", () => {
    const html = renderToStaticMarkup(
      <IdentityChips
        chips={[
          { kind: "email", label: "amy@example.test" },
          { kind: "instagram", label: "amy.ink" },
        ]}
      />,
    );
    expect(html).toContain("amy@example.test");
    expect(html).toContain("amy.ink");
    expect(renderToStaticMarkup(<IdentityChips chips={[]} />)).toBe("");
  });

  it("escapes a display name a customer chose for themselves", () => {
    // Meta display names are attacker-controlled text, not markup.
    const html = renderToStaticMarkup(
      <IdentityChips
        chips={buildIdentityChips({
          email: null,
          phone: null,
          identities: [
            { channel: "instagram", displayName: "<script>alert(1)</script>" },
          ],
        })}
      />,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
