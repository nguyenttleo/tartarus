"use client";

import { useEffect, useState } from "react";

// A one-shot boot log that plays the first time you land - Tartarus arming its
// sandbox. Pure CSS fade-out (no framer-motion dep). Once per session.
const LINES: { t: string; ok: boolean }[] = [
  { t: "TARTARUS v1.0.0 - wasmtime/WASI containment", ok: false },
  { t: "mounting /sandbox  (ro)", ok: true },
  { t: "mounting /tmp  (rw, 8M)", ok: true },
  { t: "arming fuel meter + epoch interrupt", ok: true },
  { t: "installing ResourceLimiter  (mem cap)", ok: true },
  { t: "dropping ambient authority  (no env, no sockets)", ok: true },
  { t: "sealing network namespace … none", ok: true },
  { t: "planting host canary  (out of reach)", ok: true },
  { t: "login: hacker (autologin)", ok: false },
];

export function BootSequence() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let seen = true;
    try {
      seen = !!sessionStorage.getItem("tartarus-booted");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) return;
    try {
      sessionStorage.setItem("tartarus-booted", "1");
    } catch {}
    const showTimer = window.setTimeout(() => setShow(true), 0);
    let fadeTimer: number | undefined;
    let hideTimer: number | undefined;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= LINES.length) {
        clearInterval(id);
        fadeTimer = window.setTimeout(() => setFading(true), 460);
        hideTimer = window.setTimeout(() => setShow(false), 980);
      }
    }, 150);
    return () => {
      window.clearTimeout(showTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      clearInterval(id);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col justify-center bg-background px-8 text-sm transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      <div className="mx-auto w-full max-w-2xl">
        {LINES.slice(0, n).map((l, idx) => (
          <div key={idx} className="leading-relaxed">
            {l.ok ? (
              <>
                <span className="prompt glow">[ ok ]</span>{" "}
                <span className="text-muted">{l.t}</span>
              </>
            ) : (
              <span className="prompt glow">{l.t}</span>
            )}
          </div>
        ))}
        <span className="prompt glow animate-blink">█</span>
      </div>
    </div>
  );
}
