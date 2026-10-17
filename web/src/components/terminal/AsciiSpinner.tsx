"use client";

import { useEffect, useRef } from "react";
import type { SpinModel } from "./spinModels";

// Drawn on a canvas because braille glyphs space their dot columns unevenly.
const PITCH_X = 2.93;
const PITCH_Y = 2.75;
const DOT_RADIUS = 0.72;
const REST_ANGLE = 0.6;
const QUARTER = Math.PI / 2;
const SETTLE_HOLD_MS = 2600;

export type CageStatus = "idle" | "running" | "ok" | "warn" | "bad" | "breach";

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
  status = "idle",
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
  status?: CageStatus;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLSpanElement>(null);
  const backRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef(status);
  const redrawRef = useRef<() => void>(() => {});
  const DW = cols * 2;
  const DH = rows * 4;
  const cssWidth = DW * PITCH_X;
  const cssHeight = DH * PITCH_Y;

  useEffect(() => {
    statusRef.current = status;
    // Repaint when the frame loop is paused.
    const frame = requestAnimationFrame(() => redrawRef.current());
    return () => cancelAnimationFrame(frame);
  }, [status]);

  useEffect(() => {
    const cage = ref.current;
    const canvas = canvasRef.current;
    const frontSwatch = frontRef.current;
    const backSwatch = backRef.current;
    const ctx = canvas?.getContext("2d");
    if (!cage || !canvas || !ctx || !frontSwatch || !backSwatch) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = motion.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const sX = scale;
    const sY = scale * aspect;
    const front = new Uint8Array(DW * DH);
    const back = new Uint8Array(DW * DH);
    const depth = new Float32Array(DW * DH);

    const draw = (angle: number) => {
      front.fill(0);
      back.fill(0);
      depth.fill(Infinity);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const project = (v: number[]): [number, number, number, number] => {
        const x1 = v[0] * cosA + v[2] * sinA;
        const z1 = -v[0] * sinA + v[2] * cosA;
        const y1 = v[1];
        const y2 = y1 * cosT - z1 * sinT;
        const z2 = y1 * sinT + z1 * cosT;
        const p = ortho ? 1 : 4 / (4 + z2);
        return [Math.round(DW / 2 + x1 * p * sX), Math.round(DH / 2 - (y2 - yoff) * p * sY), z2, z1];
      };

      const setDot = (x: number, y: number, z: number, facing: number) => {
        if (x < 0 || x >= DW || y < 0 || y >= DH) return;
        const index = y * DW + x;
        if (z >= depth[index]) return;
        depth[index] = z;
        front[index] = facing < 0 ? 1 : 0;
        back[index] = facing >= 0 ? 1 : 0;
      };

      const line = (a: [number, number, number, number], b: [number, number, number, number], face?: number) => {
        let x = a[0];
        let y = a[1];
        const dx = Math.abs(b[0] - a[0]);
        const dy = Math.abs(b[1] - a[1]);
        const steps = Math.max(dx, dy) || 1;
        const sx = a[0] < b[0] ? 1 : -1;
        const sy = a[1] < b[1] ? 1 : -1;
        let err = dx - dy;
        for (let step = 0; step <= steps; step++) {
          setDot(x, y, a[2] + ((b[2] - a[2]) * step) / steps, face ?? a[3] + ((b[3] - a[3]) * step) / steps);
          if (x === b[0] && y === b[1]) break;
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

      for (let e = 0; e < model.edges.length; e++) {
        const [i, j] = model.edges[e];
        const start = model.verts[i];
        const end = model.verts[j];
        let face: number | undefined;
        if (model.cage) {
          const { x, y, z } = model.cage;
          const faces: number[] = [];
          if (Math.abs(start[0]) === x && start[0] === end[0]) faces.push(-start[0] * sinA);
          if (Math.abs(start[2]) === z && start[2] === end[2]) faces.push(start[2] * cosA);
          const near = faces.some((depth) => depth < -0.000001);
          const vertical = start[1] !== end[1];
          const bottom = start[1] === -y && end[1] === -y;
          if ((vertical || bottom) && !near) continue;
          face = near ? -1 : 1;
        }
        line(project(start), project(end), face);
      }

      // Colours come from the .cage-front and .cage-back swatches.
      const paint = (dots: Uint8Array, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < dots.length; i++) {
          if (!dots[i]) continue;
          const x = ((i % DW) + 0.5) * PITCH_X;
          const y = (Math.floor(i / DW) + 0.5) * PITCH_Y;
          ctx.moveTo(x + DOT_RADIUS, y);
          ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        }
        ctx.fill();
      };
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      paint(back, getComputedStyle(backSwatch).color);
      paint(front, getComputedStyle(frontSwatch).color);
    };

    let raf = 0;
    let active = true;
    let dragging = false;
    let visible = cage.getClientRects().length > 0;
    let pointerX = 0;
    let last = 0;
    let angle = REST_ANGLE;
    let spin = speed;
    let seenStatus = statusRef.current;
    let settleTo: number | null = null;
    let holdUntil = 0;
    const loop = (t: number) => {
      if (!active || document.hidden || !visible) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const current = statusRef.current;
      if (current !== seenStatus) {
        seenStatus = current;
        if (current === "idle" || current === "running") {
          settleTo = null;
        } else {
          // Settle into the next three-quarter pose.
          settleTo = REST_ANGLE + Math.ceil((angle - REST_ANGLE) / QUARTER + 0.25) * QUARTER;
          holdUntil = t + SETTLE_HOLD_MS;
          spin = 0;
        }
      }
      if (!dragging) {
        if (settleTo !== null) {
          angle += (settleTo - angle) * (1 - Math.exp(-dt * 5));
          if (t > holdUntil) settleTo = null;
        } else {
          const target = current === "running" ? speed * 5 : speed;
          spin += (target - spin) * (1 - Math.exp(-dt * 2.5));
          angle += spin * dt;
        }
      }
      draw(angle);
      raf = requestAnimationFrame(loop);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      pointerX = event.clientX;
      cage.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      angle += (event.clientX - pointerX) * 0.012;
      pointerX = event.clientX;
      draw(angle);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      last = 0;
      if (cage.hasPointerCapture(event.pointerId)) cage.releasePointerCapture(event.pointerId);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      angle += event.key === "ArrowLeft" ? -0.16 : 0.16;
      draw(angle);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (active && visible && !document.hidden && !reduce) raf = requestAnimationFrame(loop);
    };
    const onMotionChange = () => {
      reduce = motion.matches;
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    observer.observe(cage);

    const repaint = () => draw(angle);
    redrawRef.current = repaint;
    draw(angle);
    schedule();
    frontSwatch.addEventListener("transitionend", repaint);
    cage.addEventListener("pointerdown", onPointerDown);
    cage.addEventListener("pointermove", onPointerMove);
    cage.addEventListener("pointerup", onPointerUp);
    cage.addEventListener("pointercancel", onPointerUp);
    cage.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", onMotionChange);

    return () => {
      active = false;
      redrawRef.current = () => {};
      cancelAnimationFrame(raf);
      observer.disconnect();
      frontSwatch.removeEventListener("transitionend", repaint);
      cage.removeEventListener("pointerdown", onPointerDown);
      cage.removeEventListener("pointermove", onPointerMove);
      cage.removeEventListener("pointerup", onPointerUp);
      cage.removeEventListener("pointercancel", onPointerUp);
      cage.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", schedule);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [model, DW, DH, cssWidth, cssHeight, scale, yoff, tilt, aspect, speed, ortho]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Spinning cage. Drag or use arrow keys to rotate it."
      tabIndex={0}
      title="Drag to rotate"
      data-status={status}
      className={`cage select-none ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: cssWidth, height: cssHeight }} />
      <span ref={backRef} aria-hidden="true" className="cage-swatch cage-back" />
      <span ref={frontRef} aria-hidden="true" className="cage-swatch cage-front" />
    </div>
  );
}
