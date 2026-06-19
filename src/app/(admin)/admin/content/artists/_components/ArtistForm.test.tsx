import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistForm } from "./ArtistForm";
import { emptyDraft } from "./artist-draft";

const noop = vi.fn();
const styles = [
  { id: "s1", name: "Fine-line" },
  { id: "s2", name: "Bold" },
];

function render(isNew: boolean) {
  return renderToStaticMarkup(
    <ArtistForm
      draft={emptyDraft()}
      styles={styles}
      isNew={isNew}
      pending={false}
      onChange={noop}
      onToggleStyle={noop}
      onSubmit={noop}
      onCancel={noop}
    />,
  );
}

describe("ArtistForm", () => {
  it("on create shows the email + access role and the new field set", () => {
    const html = render(true);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="accessRole"');
    expect(html).toContain('name="status"');
    expect(html).toContain('name="hourlyRatePounds"');
    expect(html).toContain('name="dayRatePounds"');
    expect(html).toContain("Fine-line");
    expect(html).toContain('value="s1"');
    expect(html).not.toContain('name="rateText"');
  });

  it("on edit hides the account email + access role", () => {
    const html = render(false);
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="accessRole"');
    expect(html).toContain('name="status"');
  });
});
