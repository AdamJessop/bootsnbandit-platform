import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaffGate, StaffUnlock } from "./StaffGate";

const verify = async () => ({ ok: true }) as const;

/**
 * Static contract for the two gate modes. The press-and-hold timing and the
 * PIN round-trip run in the browser; the pure pieces (pin shape, hold length)
 * are covered in kiosk-logic.test.ts and the server check in actions.test.ts.
 */
describe("StaffUnlock", () => {
  it("shows a PIN pad (digits, delete, disabled Unlock) when a studio PIN is set", () => {
    const html = renderToStaticMarkup(
      <StaffUnlock pinConfigured onVerifyPin={verify} onUnlocked={() => {}} />,
    );
    for (const d of "0123456789") {
      expect(html).toContain(`aria-label="${d}"`);
    }
    expect(html).toContain('aria-label="Delete digit"');
    expect(html).toMatch(/<button[^>]*class="btn btn-lg"[^>]*disabled=""/);
    expect(html).toContain("Unlock");
    expect(html).not.toContain("rk-hold");
  });

  it("falls back to press-and-hold when no PIN is configured", () => {
    const html = renderToStaticMarkup(
      <StaffUnlock
        pinConfigured={false}
        onVerifyPin={verify}
        onUnlocked={() => {}}
        holdLabel="Hold to confirm ID checked"
      />,
    );
    expect(html).toContain('class="rk-hold"');
    expect(html).toContain("Hold to confirm ID checked");
    expect(html).toContain("--hold-ms:2000ms");
    expect(html).not.toContain("rk-pin-keys");
  });
});

describe("StaffGate", () => {
  it("is a full-screen staff-only overlay with a Back button", () => {
    const html = renderToStaticMarkup(
      <StaffGate
        pinConfigured={false}
        onVerifyPin={verify}
        onUnlocked={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('class="rk-screen rk-gate"');
    expect(html).toContain("Staff only");
    expect(html).toContain("Press and hold the button for 2 seconds");
    expect(html).toContain("Back");
  });

  it("asks for the studio PIN in PIN mode", () => {
    const html = renderToStaticMarkup(
      <StaffGate
        pinConfigured
        onVerifyPin={verify}
        onUnlocked={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain("Enter the studio PIN");
  });
});
