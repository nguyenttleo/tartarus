"use client";

import { useEffect, useRef } from "react";
import type { SpinModel } from "./spinModels";

// Renders a 3D wireframe model spinning around its Y axis as live terminal text.
// Uses Braille sub-pixel rendering (2x4 dots per character) for smooth lines,
// and delta-time rotation so the spin speed is steady regardless of frame rate.
// Writes straight to the <pre> via a ref (no React re-render per frame), pauses
// when the tab is hidden, and falls back to a single static frame under
// prefers-reduced-motion. Always render inside an out-of-flow wrapper so its
// height never affects the surrounding layout.
const LEFT_BITS = [0x01, 0x02, 0x04, 0x40];
const RIGHT_BITS = [0x08, 0x10, 0x20, 0x80];

export function AsciiSpinner({
  model,
  cols = 32,
  rows = 16,
  scale = 16,
  yoff = 0,
  tilt = -0.5,
  aspect = 1.14,
  speed = 0.8,
  ortho = false,
  className = "",
}: {
  model: SpinModel;
  cols?: number;
  rows?: number;
  scale?: number;
  yoff?: number;
  tilt?: number;
  aspect?: number;
  speed?: number;
  ortho?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = ref.current;
    if (!pre) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DW = cols * 2;
    const DH = rows * 4;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const sX = scale;
    const sY = scale * aspect;
    const dots = new Uint8Array(DW * DH);

    const draw = (angle: number) => {
      dots.fill(0);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const project = (v: number[]): [number, number, number] => {
        const x1 = v[0] * cosA + v[2] * sinA;
        const z1 = -v[0] * sinA + v[2] * cosA;
        const y1 = v[1];
        const y2 = y1 * cosT - z1 * sinT;
        const z2 = y1 * sinT + z1 * cosT;
        // Orthographic keeps straight 3D edges (e.g. cage bars) perfectly straight;
        // perspective gives a little depth to rounder shapes.
        const p = ortho ? 1 : 4 / (4 + z2);
        return [Math.round(DW / 2 + x1 * p * sX), Math.round(DH / 2 - (y2 - yoff) * p * sY), z2];
      };

      const setDot = (x: number, y: number) => {
        if (x < 0 || x >= DW || y < 0 || y >= DH) return;
        dots[y * DW + x] = 1;
      };

      const line = (x0: number, y0: number, x1: number, y1: number) => {
        let x = x0;
        let y = y0;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        for (let guard = 0; guard < 4096; guard++) {
          setDot(x, y);
          if (x === x1 && y === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) {
            err -= dy;
            x += sx;
          }
          if (e2 < dx) {
            err += dx;
            y += sy;
          }
        }
      };

      const cullFrom = model.cullFrom ?? Infinity;
      for (let e = 0; e < model.edges.length; e++) {
        const [i, j] = model.edges[e];
        const a = project(model.verts[i]);
        const b = project(model.verts[j]);
        // Frame edges (index < cullFrom) always draw, so the box never breaks up;
        // bars past it are back-face culled when their midpoint sits behind centre.
        if (e >= cullFrom && (a[2] + b[2]) / 2 > 0.2) continue;
        line(a[0], a[1], b[0], b[1]);
      }

      let out = "";
      for (let cy = 0; cy < rows; cy++) {
        let row = "";
        for (let cx = 0; cx < cols; cx++) {
          let mask = 0;
          for (let dy = 0; dy < 4; dy++) {
            if (dots[(cy * 4 + dy) * DW + cx * 2]) mask |= LEFT_BITS[dy];
            if (dots[(cy * 4 + dy) * DW + cx * 2 + 1]) mask |= RIGHT_BITS[dy];
          }
          row += mask ? String.fromCharCode(0x2800 + mask) : " ";
        }
        out += row.replace(/\s+$/, "") + "\n";
      }
      pre.textContent = out;
    };

    if (reduce) {
      draw(0.7);
      return;
    }

    let raf = 0;
    let running = true;
    let last = 0;
    let angle = 0.6;
    const loop = (t: number) => {
      if (!running) return;
      if (last) angle += ((t - last) / 1000) * speed;
      last = t;
      draw(angle);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      running = !document.hidden;
      last = 0;
      if (running) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [model, cols, rows, scale, yoff, tilt, aspect, speed, ortho]);

  return (
    <pre
      ref={ref}
      aria-hidden
      className={`select-none font-mono text-[10px] leading-[1.05] text-accent glow ${className}`}
    />
  );
}
