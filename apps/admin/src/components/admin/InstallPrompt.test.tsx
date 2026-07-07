import { describe, expect, it } from "vitest";
import { InstallPrompt } from "./InstallPrompt";

/**
 * The install button is browser-only glue: it renders nothing until the
 * `beforeinstallprompt` event fires, then calls prompt() on click. That event
 * cannot fire under node/vitest; assert the module boundary here.
 */
describe("InstallPrompt module", () => {
  it("exports the client component", () => {
    expect(typeof InstallPrompt).toBe("function");
  });
});
