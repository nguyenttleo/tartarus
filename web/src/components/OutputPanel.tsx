"use client";

import type { ReactNode } from "react";
import type { Outcome, RunResult } from "@/lib/types";

const OUTCOME_LABEL: Record<Outcome, string> = {
  completed: "completed",
  timed_out: "killed · wall-clock",
  out_of_memory: "killed · memory",
  cpu_exhausted: "killed · CPU/fuel",
  trapped: "trapped",
  startup_error: "startup error",
};

export type OutcomeTone = "ok" | "warn" | "bad";

export function outcomeTone(result: RunResult): OutcomeTone {
  if (result.outcome !== "completed") return "bad";
  return result.exitCode === 0 ? "ok" : "warn";
}

const TONE_CLASS: Record<OutcomeTone, string> = {
  ok: "text-verdigris",
  warn: "text-amber",
  bad: "text-red",
};

const TONE_BG: Record<OutcomeTone, string> = {
  ok: "bg-verdigris",
  warn: "bg-amber",
  bad: "bg-red",
};

type Phase = { label: string; ms: number; className: string };

// Phase durations from the trace timestamps.
function phases(result: RunResult): Phase[] | null {
  const at = (kind: string) => result.trace.find((e) => e.kind === kind)?.tMs;
  const first = result.trace[0]?.tMs;
  const staged = at("fs.stage");
  const loaded = at("module.load");
  const guestStart = at("guest.start");
  if (first === undefined || guestStart === undefined) return null;
  const load = staged !== undefined && loaded !== undefined ? Math.max(0, loaded - staged) : 0;
  return [
    { label: "sandbox", ms: Math.max(0, guestStart - first - load), className: "bg-[#5d5a54]" },
    { label: "interpreter", ms: load, className: "bg-[#8a867d]" },
    { label: "your code", ms: result.durationMs, className: TONE_BG[outcomeTone(result)] },
  ];
}

const formatMs = (ms: number) => (ms < 1 ? "<1 ms" : `${Math.round(ms).toLocaleString()} ms`);

function TimingStrip({ parts }: { parts: Phase[] }) {
  const total = parts.reduce((sum, p) => sum + p.ms, 0);
  return (
    <div>
      <div className="timing-bar" role="img" aria-label={parts.map((p) => `${p.label} ${formatMs(p.ms)}`).join(", ")}>
        {parts.map((p, i) => (
          <span
            key={p.label}
            className={p.className}
            style={{ flexGrow: total > 0 ? p.ms : i === parts.length - 1 ? 1 : 0 }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-muted">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={`timing-swatch ${p.className}`} aria-hidden />
            {p.label} {formatMs(p.ms)}
          </span>
        ))}
        <span className="ml-auto">{formatMs(total)} total</span>
      </div>
    </div>
  );
}

export function OutputPanel({
  result,
  error,
  idle,
}: {
  result: RunResult | null;
  error: string | null;
  idle: ReactNode;
}) {
  if (error) {
    return (
      <div className="h-full overflow-auto p-4">
        <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-red">
          <span className="text-red/70">error:</span> {error}
        </pre>
      </div>
    );
  }
  if (!result) return <>{idle}</>;
  const timing = phases(result);

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-4 text-sm">
      <div className="console-meta flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
        <span className={TONE_CLASS[outcomeTone(result)]}>{OUTCOME_LABEL[result.outcome]}</span>
        <span>exit {result.exitCode ?? "-"}</span>
        {!timing && <span>{result.durationMs} ms</span>}
        {result.fuelUsed != null && <span>{result.fuelUsed.toLocaleString()} fuel</span>}
        {result.timedOut && <span className="text-red">timed out</span>}
        {result.oom && <span className="text-red">out of memory</span>}
        {result.outputTruncated && <span className="text-amber">truncated</span>}
        <span>{result.backend}</span>
      </div>

      {timing && <TimingStrip parts={timing} />}

      <Section title="stdout" body={result.stdout} empty="(no stdout)" />
      <Section title="stderr" body={result.stderr} empty="(no stderr)" tone="red" />
    </div>
  );
}

function Section({
  title,
  body,
  empty,
  tone,
}: {
  title: string;
  body: string;
  empty: string;
  tone?: "red";
}) {
  return (
    <div>
      <div className="ui-label mb-1.5">{title}</div>
      <pre
        className={`console-output max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-6 ${
          body ? (tone === "red" ? "text-red" : "text-foreground") : "console-empty"
        }`}
      >
        {body || empty}
      </pre>
    </div>
  );
}
