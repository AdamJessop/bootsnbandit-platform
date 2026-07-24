"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Finger/stylus signature pad. Draws to a DPR-scaled canvas; reports state
 * changes upward via `onChange(signed)` and exposes the drawing as a PNG data
 * URL through `getDataUrl` (assigned to the ref-like `api` prop object).
 */
export interface SignaturePadApi {
  getDataUrl: () => string | null;
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
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#fbf7f0";
  }, []);

  useEffect(() => {
    if (!api) return;
    api.getDataUrl = () => {
      if (emptyRef.current || !canvasRef.current) return null;
      return canvasRef.current.toDataURL("image/png");
    };
  }, [api]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
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
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
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
