"use client";

import { useEffect, useRef } from "react";

// A living fractal-noise ASCII field - the "desktop" the Tartarus console floats on.
// Pure canvas, phosphor green, reacts to the cursor. Sits behind everything (-z-10).
const RAMP = " .`':,-~+=*xX#%@";

function makeFbm() {
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    const u = smooth(xf);
    const v = smooth(yf);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  return (x: number, y: number) => {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 3; i++) {
      val += amp * noise(x * freq, y * freq);
      freq *= 2;
      amp *= 0.5;
    }
    return val;
  };
}

export function AsciiField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fbm = makeFbm();
    const fontSize = 14;
    const cellW = fontSize * 0.6;
    const cellH = fontSize * 1.05;
    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let t = 0;
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      if (cols === 0 || rows === 0) return;
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      const mcx = mouse.x / cellW;
      const mcy = mouse.y / cellH;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(70, 247, 164, 0.20)";
      for (let r = 0; r < rows; r++) {
        let line = "";
        for (let c = 0; c < cols; c++) {
          const dx = c - mcx;
          const dy = r - mcy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const infl = Math.max(0, 1 - dist / 20);
          const nx = c * 0.05 + dx * 0.012 * infl;
          const ny = r * 0.08 + dy * 0.012 * infl;
          let v = fbm(nx + t * 0.012, ny - t * 0.008);
          v = v * 0.85 + infl * 0.55;
          let idx = Math.floor(v * RAMP.length);
          if (idx < 0) idx = 0;
          if (idx >= RAMP.length) idx = RAMP.length - 1;
          line += RAMP[idx];
        }
        ctx.fillText(line, 0, r * cellH);
      }
      t += 1;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px ui-monospace, "JetBrains Mono", monospace`;
      ctx.textBaseline = "top";
      cols = Math.ceil(W / cellW) + 1;
      rows = Math.ceil(H / cellH) + 1;
      render();
    };

    const onMove = (e: MouseEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    let running = true;
    if (!reduce) {
      const loop = () => {
        if (!running) return;
        render();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const onVis = () => {
      running = !document.hidden;
      if (running && !reduce) raf = requestAnimationFrame(() => render());
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ opacity: 0.5 }}
    />
  );
}
