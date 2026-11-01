import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { POLICY_UPDATED, PRIVACY_EMAIL } from "@/lib/legal";
import PrivacyPage, { metadata } from "./page";

describe("PrivacyPage", () => {
  it("renders the policy sections, contact email and last-updated date", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("Privacy policy");
    expect(html).toContain("What we collect");
    expect(html).toContain("Why we use it");
    expect(html).toContain("Who else handles it");
    expect(html).toContain("How long we keep it");
    expect(html).toContain("Your rights");
    expect(html).toContain(`mailto:${PRIVACY_EMAIL}`);
    expect(html).toContain(`Last updated: ${POLICY_UPDATED}`);
  });

  it("names the processors the codebase actually uses", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("Hetzner");
    expect(html).toContain("Resend");
    expect(html).toContain("Meta Platforms");
    expect(html).toContain("Brave Search");
    expect(html).toContain("bb_customer_session");
    expect(html).toContain("ico.org.uk");
  });

  it("anchors the Facebook/Instagram section and links to /data-deletion", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain('id="data-deletion"');
    expect(html).toContain('href="/data-deletion"');
  });

  it("titles the page for the public site", () => {
    expect(metadata.title).toContain("Privacy");
    expect(metadata.title).toContain("Boots 'n' Bandit");
  });
});
