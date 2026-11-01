import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IdleGuard } from "./IdleGuard";

/**
 * The countdown itself runs on timers in the browser; its timing maths is the
 * pure `idleStage` (kiosk-logic.test.ts). Here: nothing renders until the
 * kiosk has actually been idle.
 */
describe("IdleGuard", () => {
  it("renders nothing while inactive or before any idle time has passed", () => {
    expect(
      renderToStaticMarkup(<IdleGuard active={false} onReset={() => {}} />),
    ).toBe("");
    expect(renderToStaticMarkup(<IdleGuard active onReset={() => {}} />)).toBe(
      "",
    );
  });
});
