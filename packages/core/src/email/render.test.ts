import { describe, expect, it } from "vitest";
import { renderEmail } from "./render";
import type { EmailType } from "./index";

/**
 * Every template must render to non-empty HTML and surface its key fields.
 * Studio footer facts must always be present.
 */

const STUDIO_ADDRESS = "67 Newcastle Avenue";

function expectHtmlBasics(html: string, subject: string) {
  expect(typeof html).toBe("string");
  expect(html.length).toBeGreaterThan(0);
  expect(html).toContain("<html");
  expect(typeof subject).toBe("string");
  expect(subject.length).toBeGreaterThan(0);
  // Studio footer facts on every email.
  expect(html).toContain(STUDIO_ADDRESS);
  expect(html).toContain("Boots");
}

describe("renderEmail", () => {
  it("renders confirmation with booking details", async () => {
    const { subject, html } = await renderEmail("confirmation", {
      customerName: "Ada Lovelace",
      artistName: "Marnie",
      date: "Saturday 5 July, 2:00pm",
      placement: "Forearm",
    });
    expectHtmlBasics(html, subject);
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Marnie");
    expect(html).toContain("Saturday 5 July, 2:00pm");
  });

  it("renders reminder with date", async () => {
    const { subject, html } = await renderEmail("reminder", {
      customerName: "Ada",
      artistName: "Cal",
      date: "Tomorrow at 11am",
    });
    expectHtmlBasics(html, subject);
    expect(html).toContain("Tomorrow at 11am");
    expect(html).toContain("Cal");
  });

  it("renders receipt with amount in pounds, bankRef and line items", async () => {
    const { subject, html } = await renderEmail("receipt", {
      customerName: "Ada",
      amountPence: 12500,
      bankRef: "BNB-1042",
      lineItems: [
        { label: "Half-day session", amountPence: 10000 },
        { label: "Touch-up", amountPence: 2500 },
      ],
    });
    expectHtmlBasics(html, subject);
    // 12500 pence -> £125.00
    expect(html).toContain("£125.00");
    expect(html).toContain("BNB-1042");
    expect(html).toContain("Half-day session");
    expect(html).toContain("£100.00");
    expect(html).toContain("Touch-up");
    expect(html).toContain("£25.00");
  });

  it("renders aftercare with link and the five healing stages", async () => {
    const { subject, html } = await renderEmail("aftercare", {
      customerName: "Ada",
    });
    expectHtmlBasics(html, subject);
    expect(html).toContain("/aftercare");
    // Five stage titles ("&" is HTML-entity encoded in the output).
    expect(html).toContain("Fresh &amp; wrapped");
    expect(html).toContain("Settling in");
    expect(html).toContain("itchy peel");
    expect(html).toContain("Almost there");
    expect(html).toContain("Healed");
  });

  it("renders review_request with a tokenised review link", async () => {
    const { subject, html } = await renderEmail("review_request", {
      customerName: "Ada",
      artistName: "Sarah",
      reviewToken: "tok_abc123",
    });
    expectHtmlBasics(html, subject);
    expect(html).toContain("/review/tok_abc123");
    expect(html).toContain("Sarah");
  });

  it("renders enquiry_ack confirming the enquiry", async () => {
    const { subject, html } = await renderEmail("enquiry_ack", {
      customerName: "Ada",
      subjectIdea: "Snake and peony half sleeve",
    });
    expectHtmlBasics(html, subject);
    expect(html.toLowerCase()).toContain("enquiry");
    expect(html).toContain("Snake and peony half sleeve");
  });

  it("renders loyalty_reward with the reward and stamp count", async () => {
    const { subject, html } = await renderEmail("loyalty_reward", {
      customerName: "Ada",
      rewardLabel: "Free small tattoo",
      stamps: 8,
    });
    expectHtmlBasics(html, subject);
    expect(html).toContain("Free small tattoo");
    expect(html).toContain("8");
  });

  it("renders staff_invite with the redeem URL", async () => {
    const { subject, html } = await renderEmail("staff_invite", {
      inviteeName: "Jordan",
      url: "http://localhost:3000/sign-in?invite=tok_xyz",
      role: "ARTIST",
      expiresAt: "2026-07-01T00:00:00.000Z",
    });
    expectHtmlBasics(html, subject);
    expect(html).toContain("Jordan");
    expect(html).toContain("invite=tok_xyz");
    expect(subject.toLowerCase()).toContain("invite");
  });

  it("renders staff_reply with paragraphs, preserved line breaks and greeting", async () => {
    const { subject, html } = await renderEmail("staff_reply", {
      customerName: "Ada",
      body: "Thanks for sending the reference over.\nIt looks great.\n\nSarah has space in August — shall we pencil you in?",
    });
    expectHtmlBasics(html, subject);
    expect(subject).toBe("A message from Boots 'n' Bandit");
    expect(html).toContain("Ada");
    expect(html).toContain("Thanks for sending the reference over.");
    // Single newline inside a paragraph → <br />.
    expect(html).toContain("<br");
    expect(html).toContain("Sarah has space in August");
  });

  it("uses the provided subject for staff_reply when given", async () => {
    const { subject, html } = await renderEmail("staff_reply", {
      customerName: "Ada",
      subject: "About your snake design",
      body: "Quick update on the drawing.",
    });
    expect(subject).toBe("About your snake design");
    expect(html).toContain("Quick update on the drawing.");
  });

  it("builds customer-facing links from PUBLIC_SITE_ORIGIN, not the (admin) app origin", async () => {
    const origPublic = process.env.PUBLIC_SITE_ORIGIN;
    const origApp = process.env.APP_ORIGIN;
    process.env.PUBLIC_SITE_ORIGIN = "https://public.example";
    process.env.APP_ORIGIN = "https://admin.example";
    try {
      const aftercare = await renderEmail("aftercare", { customerName: "Ada" });
      expect(aftercare.html).toContain("https://public.example/aftercare");
      expect(aftercare.html).not.toContain("https://admin.example");

      const review = await renderEmail("review_request", {
        customerName: "Ada",
        reviewToken: "tok_abc123",
      });
      expect(review.html).toContain("https://public.example/review/tok_abc123");
      expect(review.html).not.toContain("https://admin.example");
    } finally {
      if (origPublic === undefined) delete process.env.PUBLIC_SITE_ORIGIN;
      else process.env.PUBLIC_SITE_ORIGIN = origPublic;
      if (origApp === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = origApp;
    }
  });

  it("falls back to http://localhost:3000 for customer links when PUBLIC_SITE_ORIGIN is unset", async () => {
    const origPublic = process.env.PUBLIC_SITE_ORIGIN;
    delete process.env.PUBLIC_SITE_ORIGIN;
    try {
      const { html } = await renderEmail("aftercare", { customerName: "Ada" });
      expect(html).toContain("http://localhost:3000/aftercare");
    } finally {
      if (origPublic !== undefined) process.env.PUBLIC_SITE_ORIGIN = origPublic;
    }
  });

  it("produces a distinct, non-empty subject for every EmailType", async () => {
    const types: EmailType[] = [
      "confirmation",
      "reminder",
      "receipt",
      "aftercare",
      "review_request",
      "enquiry_ack",
      "loyalty_reward",
      "staff_invite",
      "staff_reply",
    ];
    const subjects = new Set<string>();
    for (const t of types) {
      const { subject } = await renderEmail(t, { customerName: "X" });
      expect(subject.length).toBeGreaterThan(0);
      subjects.add(subject);
    }
    expect(subjects.size).toBe(types.length);
  });
});
