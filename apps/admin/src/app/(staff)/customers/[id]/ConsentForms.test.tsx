import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsentForms } from "./ConsentForms";
import type { ConsentRecord } from "./consent-records";

const record: ConsentRecord = {
  id: "f1",
  bookingId: "b1",
  signedAt: "2026-11-01T10:00:00.000Z",
  bookingStart: "2026-11-01T10:30:00.000Z",
  bookingType: "session",
  artistName: "Sarah",
  version: 2,
  flagged: true,
  printedName: "Megan Wray",
  dob: "1990-01-15",
  medicalNotes: "Inhaler in bag",
  photoConsent: false,
  idCheckedBy: "Sarah",
  idCheckedAt: "2026-11-01T10:01:00.000Z",
  signature: "data:image/png;base64,SIG",
  lightInkSignature: false,
  answers: [
    { id: "age", q: "I am 18 or over.", answer: "Yes", flagged: false },
    {
      id: "diabetes",
      q: "Do you have diabetes?",
      answer: "Yes",
      flagged: true,
    },
  ],
};

describe("ConsentForms", () => {
  it("shows date, version, DOB, ID checker, answers, notes and the signature", () => {
    const html = renderToStaticMarkup(<ConsentForms records={[record]} />);
    expect(html).toContain("Signed 01 Nov 2026");
    expect(html).toContain("form v2");
    expect(html).toContain("Session with");
    expect(html).toContain("Megan Wray");
    expect(html).toContain("15 Jan 1990");
    expect(html).toContain("ID checked by: ");
    expect(html).toContain("Sarah · 01 Nov 2026");
    expect(html).toContain("No photos");
    expect(html).toContain("Inhaler in bag");
    expect(html).toContain('src="data:image/png;base64,SIG"');
    expect(html).toContain("bg-white");
    expect(html).toContain("Flagged");
  });

  it("highlights only the flagged answers", () => {
    const html = renderToStaticMarkup(<ConsentForms records={[record]} />);
    expect(html.match(/data-flagged="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /data-flagged="true"[^>]*>[\s\S]*Do you have diabetes\?/,
    );
  });

  it("gives old light-ink signatures a dark backing", () => {
    const html = renderToStaticMarkup(
      <ConsentForms records={[{ ...record, lightInkSignature: true }]} />,
    );
    expect(html).toContain("bg-bg-base");
    expect(html).not.toContain("bg-white");
  });

  it("has a plain empty state and no edit controls", () => {
    expect(renderToStaticMarkup(<ConsentForms records={[]} />)).toContain(
      "No consent forms signed on the kiosk yet.",
    );
    const html = renderToStaticMarkup(<ConsentForms records={[record]} />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });
});
