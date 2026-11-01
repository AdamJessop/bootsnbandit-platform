import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SIGNATURE_INK,
  SIGNATURE_PAPER,
  SignaturePad,
  exportSignature,
  fitScale,
} from "./SignaturePad";

/**
 * The pad's pointer drawing runs against a real canvas in the browser (covered
 * by the end-to-end kiosk flow); assert the static contract — canvas, hint and
 * clear affordance — plus the pure export and resize maths.
 */
describe("SignaturePad", () => {
  it("renders the canvas with the finger hint and a clear button", () => {
    const html = renderToStaticMarkup(<SignaturePad onChange={() => {}} />);
    expect(html).toContain("<canvas");
    expect(html).toContain("Sign here with your finger");
    expect(html).toContain("Clear");
  });
});

/** A canvas stand-in that records what the export paints. */
function fakeCanvas() {
  const ops: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    fillRect: (x: number, y: number, w: number, h: number) =>
      ops.push(`fill ${ctx.fillStyle} ${x},${y},${w},${h}`),
    scale: (x: number) => ops.push(`scale ${x}`),
    beginPath: () => {},
    moveTo: (x: number, y: number) => ops.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => ops.push(`line ${x},${y}`),
    stroke: () => ops.push(`stroke ${ctx.strokeStyle}`),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: (type: string) => `data:${type};base64,FAKE`,
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, ops };
}

describe("exportSignature", () => {
  it("paints black ink over an opaque white page at 2× the signing size", () => {
    const { canvas, ops } = fakeCanvas();
    const png = exportSignature(
      [
        [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
      ],
      { w: 600, h: 180 },
      () => canvas,
    );
    expect(png).toBe("data:image/png;base64,FAKE");
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(360);
    // White background first, then the strokes in black — never the light
    // on-screen ink, never transparent.
    expect(ops[0]).toBe(`fill ${SIGNATURE_PAPER} 0,0,1200,360`);
    expect(SIGNATURE_PAPER).toBe("#ffffff");
    expect(SIGNATURE_INK).toBe("#000000");
    expect(ops).toContain(`stroke ${SIGNATURE_INK}`);
    expect(ops).toContain("move 10,20");
    expect(ops).toContain("line 30,40");
  });

  it("skips single-point taps", () => {
    const { canvas, ops } = fakeCanvas();
    exportSignature([[{ x: 1, y: 1 }]], { w: 100, h: 50 }, () => canvas);
    expect(ops.some((o) => o.startsWith("stroke"))).toBe(false);
  });
});

describe("fitScale (re-drawing after a rotation/resize)", () => {
  it("keeps 1:1 when the pad size is unchanged", () => {
    expect(fitScale({ w: 700, h: 180 }, { w: 700, h: 180 })).toBe(1);
  });

  it("shrinks uniformly to the tighter axis so nothing is cut off or stretched", () => {
    expect(fitScale({ w: 1000, h: 180 }, { w: 500, h: 180 })).toBe(0.5);
    expect(fitScale({ w: 500, h: 200 }, { w: 1000, h: 100 })).toBe(0.5);
  });

  it("falls back to 1 for a degenerate origin", () => {
    expect(fitScale({ w: 0, h: 0 }, { w: 500, h: 180 })).toBe(1);
  });
});
