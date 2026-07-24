import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SignaturePad } from "./SignaturePad";

/**
 * The pad's pointer drawing runs against a real canvas in the browser (covered
 * by the end-to-end kiosk flow); assert the static contract — canvas, hint and
 * clear affordance.
 */
describe("SignaturePad", () => {
  it("renders the canvas with the finger hint and a clear button", () => {
    const html = renderToStaticMarkup(<SignaturePad onChange={() => {}} />);
    expect(html).toContain("<canvas");
    expect(html).toContain("Sign here with your finger");
    expect(html).toContain("Clear");
  });
});
