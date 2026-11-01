import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PRIVACY_EMAIL } from "@/lib/legal";
import DataDeletionPage, { metadata } from "./page";

describe("DataDeletionPage", () => {
  it("renders how to ask, what is deleted and what is kept", () => {
    const html = renderToStaticMarkup(<DataDeletionPage />);
    expect(html).toContain("Delete your data");
    expect(html).toContain("How to ask");
    expect(html).toContain("What we delete");
    expect(html).toContain("What we have to keep");
    expect(html).toContain("30 days");
    expect(html).toContain("delete my data");
  });

  it("gives the contact email and the Facebook app-removal path", () => {
    const html = renderToStaticMarkup(<DataDeletionPage />);
    expect(html).toContain(`mailto:${PRIVACY_EMAIL}`);
    expect(html).toContain(PRIVACY_EMAIL);
    expect(html).toContain("Apps and websites");
  });

  it("links back to the privacy policy and its Facebook section", () => {
    const html = renderToStaticMarkup(<DataDeletionPage />);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/privacy#data-deletion"');
  });

  it("titles the page for the public site", () => {
    expect(metadata.title).toContain("Data deletion");
    expect(metadata.title).toContain("Boots 'n' Bandit");
  });
});
