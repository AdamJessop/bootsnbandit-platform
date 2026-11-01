import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistForm } from "./ArtistForm";
import { emptyDraft } from "./artist-draft";

const noop = vi.fn();
const styles = [
  { id: "s1", name: "Fine-line" },
  { id: "s2", name: "Bold" },
];

function render(
  isNew: boolean,
  draft = emptyDraft(),
  error: string | null = null,
) {
  return renderToStaticMarkup(
    <ArtistForm
      draft={draft}
      styles={styles}
      isNew={isNew}
      pending={false}
      error={error}
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

  it("suggests a neutral example email, not the studio's domain", () => {
    const html = render(true);
    expect(html).toContain('placeholder="name@example.com"');
    expect(html).not.toContain("bootsnbandit");
  });

  it("marks name/email required and holds Save until they are filled", () => {
    const blank = render(true);
    expect(blank).toMatch(/id="ae-name"[^>]*required/);
    expect(blank).toMatch(/<button[^>]*\sdisabled=""[^>]*>Save<\/button>/);
    expect(blank).toContain("Fill in Name, Account email to save.");

    const filled = render(false, { ...emptyDraft(), name: "Sarah" });
    expect(filled).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Save<\/button>/);
    expect(filled).not.toContain("Fill in");
  });

  it("offers the soft 'Show on website' toggle", () => {
    const html = render(false, { ...emptyDraft(), name: "Sarah" });
    expect(html).toContain("Show on website");
    expect(html).toContain('name="active"');
  });

  it("shows the server's error beside Save", () => {
    const html = render(
      true,
      { ...emptyDraft(), name: "Cal", email: "cal@example.com" },
      "Another user already has that email.",
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Another user already has that email.");
  });
});
