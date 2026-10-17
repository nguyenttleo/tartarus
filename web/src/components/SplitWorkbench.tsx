"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";

const STORAGE_KEY = "tartarus.workspace.split";
const MIN = 30;
const MAX = 70;

function clamp(value: number) {
  return Math.round(Math.min(MAX, Math.max(MIN, value)) * 10) / 10;
}

export function SplitWorkbench({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [ratio, setRatio] = useState(50);
  const ratioRef = useRef(50);
  const dragIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [left, right] = Children.toArray(children);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = Number(window.localStorage.getItem(STORAGE_KEY));
        if (Number.isFinite(saved) && saved >= MIN && saved <= MAX) {
          ratioRef.current = saved;
          setRatio(saved);
        }
      } catch {
        // Storage is optional.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const update = (value: number) => {
    const next = clamp(value);
    ratioRef.current = next;
    setRatio(next);
  };

  const save = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(ratioRef.current));
    } catch {
      // The split still works if storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      if (dragIdRef.current !== event.pointerId) return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const next = clamp(((event.clientX - bounds.left) / bounds.width) * 100);
      ratioRef.current = next;
      containerRef.current?.style.setProperty("--split", `${next}%`);
      dividerRef.current?.setAttribute("aria-valuenow", String(next));
    };
    const stop = (event: globalThis.PointerEvent) => {
      if (dragIdRef.current !== event.pointerId) return;
      dragIdRef.current = null;
      if (dividerRef.current?.hasPointerCapture(event.pointerId)) {
        dividerRef.current.releasePointerCapture(event.pointerId);
      }
      setRatio(ratioRef.current);
      save();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [save]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    dragIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = ratioRef.current - 5;
        break;
      case "ArrowRight":
        next = ratioRef.current + 5;
        break;
      case "Home":
        next = MIN;
        break;
      case "End":
        next = MAX;
        break;
      default:
        return;
    }
    event.preventDefault();
    update(next);
    save();
  };

  const reset = () => {
    const dragId = dragIdRef.current;
    dragIdRef.current = null;
    if (dragId !== null && dividerRef.current?.hasPointerCapture(dragId)) {
      dividerRef.current.releasePointerCapture(dragId);
    }
    update(50);
    save();
  };

  return (
    <div
      ref={containerRef}
      className={`split-workbench ${className}`}
      style={{ "--split": `${ratio}%` } as CSSProperties}
    >
      {left}
      <div
        ref={dividerRef}
        role="separator"
        tabIndex={0}
        aria-label="Resize editor and output panels"
        aria-orientation="vertical"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={ratio}
        title="Drag to resize. Double-click to reset."
        className="split-divider"
        onPointerDown={onPointerDown}
        onDoubleClick={reset}
        onKeyDown={onKeyDown}
      />
      {right}
    </div>
  );
}
