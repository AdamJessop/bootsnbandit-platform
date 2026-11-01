"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Finger/stylus signature pad. Reports state changes upward via
 * `onChange(signed)` and exposes the signature as a PNG data URL through
 * `getDataUrl` (assigned to the ref-like `api` prop object).
 *
 * Two renderings of the same strokes:
 *  - on screen, light ink on the dark kiosk theme (DPR-scaled canvas);
 *  - the saved PNG, re-drawn from the recorded strokes in black ink on an
 *    opaque white background, so the signature survives printing and white
 *    backgrounds in the admin viewer (the old pad saved near-white strokes on
 *    transparent, which vanished on paper).
 *
 * Strokes are recorded in CSS pixels relative to the pad's size when signing
 * began. The kiosk manifest allows any orientation, so when the pad resizes
 * (rotation, split view) the canvas is re-initialised for the new size and the
 * strokes re-drawn at a uniform fit scale — the signature is never stretched
 * or lost, and the export always uses the original signing size.
 */
export interface SignaturePadApi {
  getDataUrl: () => string | null;
}

interface Point {
  x: number;
  y: number;
}
interface Size {
  w: number;
  h: number;
}

const SCREEN_INK = "#fbf7f0";
/** Saved-PNG ink and paper. */
export const SIGNATURE_INK = "#000000";
export const SIGNATURE_PAPER = "#ffffff";
const LINE_WIDTH = 2.4;
/** Export resolution multiplier (crisp when printed). */
const EXPORT_SCALE = 2;

/**
 * Uniform scale that fits strokes recorded at `from` into a pad now sized
 * `to` — the tighter axis wins, so nothing is cut off or stretched. Pure for
 * testing.
 */
export function fitScale(from: Size, to: Size): number {
  if (from.w <= 0 || from.h <= 0) return 1;
  return Math.min(to.w / from.w, to.h / from.h);
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Point[][],
  scale: number,
) {
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale);
    for (const p of stroke.slice(1)) ctx.lineTo(p.x * scale, p.y * scale);
    ctx.stroke();
  }
}

function inkStyle(ctx: CanvasRenderingContext2D, color: string) {
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
}

/**
 * The saved signature: strokes re-drawn in black on an opaque white page at
 * the original signing size × EXPORT_SCALE, independent of how the on-screen
 * pad is themed or currently sized. `makeCanvas` is injectable for tests.
 */
export function exportSignature(
  strokes: Point[][],
  from: Size,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): string | null {
  const out = makeCanvas();
  out.width = Math.round(from.w * EXPORT_SCALE);
  out.height = Math.round(from.h * EXPORT_SCALE);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = SIGNATURE_PAPER;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  inkStyle(ctx, SIGNATURE_INK);
  drawStrokes(ctx, strokes, 1);
  return out.toDataURL("image/png");
}

export function SignaturePad({
  onChange,
  api,
}: {
  onChange?: (signed: boolean) => void;
  /** Optional out-param the parent reads the PNG from at submit time. */
  api?: SignaturePadApi;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(true);
  const emptyRef = useRef(true);
  const drawing = useRef(false);
  const strokes = useRef<Point[][]>([]);
  /** Pad size when the first stroke was drawn — the strokes' coordinate space. */
  const origin = useRef<Size | null>(null);
  const size = useRef<Size>({ w: 0, h: 0 });

  const scale = () =>
    origin.current ? fitScale(origin.current, size.current) : 1;

  const setup = useCallback(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    size.current = { w, h };
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Resizing a canvas wipes it and resets its state — re-apply both.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inkStyle(ctx, SCREEN_INK);
    drawStrokes(
      ctx,
      strokes.current,
      origin.current ? fitScale(origin.current, size.current) : 1,
    );
  }, []);

  useEffect(() => {
    setup();
    const wrap = wrapRef.current;
    if (typeof ResizeObserver !== "undefined" && wrap) {
      const ro = new ResizeObserver(() => setup());
      ro.observe(wrap);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", setup);
    window.addEventListener("orientationchange", setup);
    return () => {
      window.removeEventListener("resize", setup);
      window.removeEventListener("orientationchange", setup);
    };
  }, [setup]);

  useEffect(() => {
    if (!api) return;
    api.getDataUrl = () => {
      if (emptyRef.current || !origin.current) return null;
      return exportSignature(strokes.current, origin.current);
    };
  }, [api]);

  /** Pointer position in the strokes' (signing-size) coordinate space. */
  const pos = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    const s = scale() || 1;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!origin.current) origin.current = { ...size.current };
    drawing.current = true;
    strokes.current.push([pos(e)]);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const stroke = strokes.current[strokes.current.length - 1];
    if (!stroke) return;
    const last = stroke[stroke.length - 1];
    const p = pos(e);
    stroke.push(p);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const s = scale();
    ctx.beginPath();
    ctx.moveTo(last.x * s, last.y * s);
    ctx.lineTo(p.x * s, p.y * s);
    ctx.stroke();
    if (emptyRef.current) {
      emptyRef.current = false;
      setEmpty(false);
      onChange?.(true);
    }
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.restore();
    }
    strokes.current = [];
    origin.current = null;
    emptyRef.current = true;
    setEmpty(true);
    onChange?.(false);
  };

  return (
    <div>
      <div
        className="rk-sign-canvas"
        ref={wrapRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
      >
        <canvas ref={canvasRef}></canvas>
        {empty && (
          <span className="rk-sign-hint">Sign here with your finger</span>
        )}
      </div>
      <div className="rk-sign-row">
        <span className="meta">
          By signing you confirm your answers are true and you consent to the
          procedure.
        </span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}
