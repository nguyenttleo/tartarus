"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE, backendState } from "@/lib/api";
import type { Health } from "@/lib/types";
import { HEALTH_POLL_MS, type HealthSample } from "@/lib/useHealth";

const DOTS = ["⣀", "⣤", "⣶", "⣿"];
const FAILED = DOTS[0];
const DOT_FONT = '"Cascadia Mono", "DejaVu Sans Mono", "Noto Sans Mono", monospace';

// Log scale from 5 ms to 1 s.
function dots(ms: number) {
  const t = Math.log10(Math.max(ms, 5) / 5) / Math.log10(200);
  return DOTS[Math.min(3, Math.max(1, Math.round(t * 3)))];
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function uptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${seconds}s`;
}

function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function clock(at: number) {
  return new Date(at).toLocaleTimeString("en-GB", { hour12: false });
}

export function BackendStatus({
  health,
  configured,
  samples,
  onRefresh,
}: {
  health: Health | null | undefined;
  configured: boolean;
  samples: HealthSample[];
  onRefresh: () => void;
}) {
  const state = backendState(configured, health);
  const popId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const pop = popRef.current;
    const button = buttonRef.current;
    if (!pop || !button) return;
    const onBeforeToggle = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open") return;
      const rect = button.getBoundingClientRect();
      pop.style.top = `${rect.bottom + 6}px`;
      pop.style.right = `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`;
    };
    const onToggle = (event: Event) => setOpen((event as ToggleEvent).newState === "open");
    const onResize = () => {
      if (pop.matches(":popover-open")) pop.hidePopover();
    };
    pop.addEventListener("beforetoggle", onBeforeToggle);
    pop.addEventListener("toggle", onToggle);
    window.addEventListener("resize", onResize);
    return () => {
      pop.removeEventListener("beforetoggle", onBeforeToggle);
      pop.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const last = samples.at(-1);
  const good = samples.flatMap((s) => (s.ms === null ? [] : [s.ms]));
  const lastGood = [...samples].reverse().find((s) => s.ms !== null);
  let failStreak = 0;
  for (let i = samples.length - 1; i >= 0 && samples[i].ms === null; i--) failStreak++;

  let summary: ReactNode;
  let label: string;
  if (state === "ready" && health) {
    summary = (
      <>
        <span className="hidden sm:inline">{health.backend}</span>
        <Spark samples={samples} />
        <span className="tabular-nums text-foreground">{last?.ms ?? "-"} ms</span>
      </>
    );
    label = `${health.backend} backend, ${last?.ms ?? "unknown"} ms. Show details`;
  } else if (state === "offline") {
    summary = (
      <>
        <Spark samples={samples} />
        <span className="text-red">no answer</span>
      </>
    );
    label = "Backend not answering. Show details";
  } else if (state === "unconfigured") {
    summary = <span className="text-amber">api not set</span>;
    label = "No backend configured. Show details";
  } else {
    summary = <span>connecting…</span>;
    label = "Connecting to backend";
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={popId}
        aria-expanded={open}
        aria-label={label}
        className="status-readout ml-auto"
      >
        {summary}
      </button>

      <div ref={popRef} id={popId} popover="auto" role="dialog" aria-label="Backend status" className="status-popover">
        <div className="flex items-baseline justify-between gap-4">
          <span className="ui-label">backend</span>
          {configured && (
            <button type="button" onClick={onRefresh} className="link-accent text-xs">
              check again
            </button>
          )}
        </div>

        {state === "unconfigured" && (
          <p className="mt-3 text-[13px] leading-6 text-muted">
            No API URL is set. Add NEXT_PUBLIC_TARTARUS_API to web/.env.local, then restart the dev server.
          </p>
        )}

        {state === "checking" && (
          <p className="mt-3 text-[13px] leading-6 text-muted">Contacting {host(API_BASE)}…</p>
        )}

        {state === "offline" && (
          <p className="mt-3 text-[13px] leading-6 text-muted">
            No answer from <span className="text-foreground">{host(API_BASE)}</span>
            {failStreak > 1 ? ` on the last ${failStreak} checks` : ""}.{" "}
            {lastGood ? `Last reply at ${clock(lastGood.at)}.` : "It hasn't replied since this page opened."}
          </p>
        )}

        {state === "ready" && health && (
          <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1 text-[13px] leading-6">
            <dt className="text-muted">endpoint</dt>
            <dd className="min-w-0 truncate">{host(API_BASE)}</dd>
            <dt className="text-muted">latency</dt>
            <dd className="tabular-nums">
              {last?.ms} ms
              {good.length > 1 && (
                <span className="text-muted">
                  {" "}
                  · median {median(good)} ms over {good.length}
                </span>
              )}
            </dd>
            <dt className="text-muted">uptime</dt>
            <dd className="tabular-nums">{uptime(health.uptimeSeconds)}</dd>
            <dt className="text-muted">runtimes</dt>
            <dd>
              {health.languages.map((l) => (
                <div key={l.id} className={l.available ? "" : "text-faint line-through"}>
                  {l.label}
                </div>
              ))}
            </dd>
            <dt className="text-muted">max limits</dt>
            <dd className="tabular-nums">
              {health.maxLimits.wallMs.toLocaleString()} ms · {Math.round(health.maxLimits.memoryBytes / 2 ** 20)} MB
              · {Math.round(health.maxLimits.outputBytes / 1024)} KB out
            </dd>
          </dl>
        )}

        {configured && last && (
          <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted">
            Checked {clock(last.at)}. Rechecks every {HEALTH_POLL_MS / 1000} s while this tab is open.
          </p>
        )}
      </div>
    </>
  );
}

function Spark({ samples }: { samples: HealthSample[] }) {
  if (samples.length === 0) return null;
  return (
    <span aria-hidden className="spark hidden text-accent-text sm:inline" style={{ fontFamily: DOT_FONT }}>
      {samples.map((s) =>
        s.ms === null ? (
          <span key={s.at} className="text-red">
            {FAILED}
          </span>
        ) : (
          <span key={s.at}>{dots(s.ms)}</span>
        ),
      )}
    </span>
  );
}
