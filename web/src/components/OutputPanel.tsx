"use client";

import type { Outcome, RunResult } from "@/lib/types";

const OUTCOME_LABEL: Record<Outcome, string> = {
  completed: "completed",
  timed_out: "killed · wall-clock",
  out_of_memory: "killed · memory",
  cpu_exhausted: "killed · CPU/fuel",
  trapped: "trapped",
  startup_error: "startup error",
};

function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "text-accent border-accent/40"
      : tone === "warn"
        ? "text-amber border-amber/40"
        : tone === "bad"
          ? "text-red border-red/40"
          : "text-muted border-border";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] uppercase tracking-wide ${cls}`}>{children}</span>
  );
}

export function OutputPanel({ result, error }: { result: RunResult | null; error: string | null }) {
  if (error) {
    return <div className="p-4 text-sm text-red">error: {error}</div>;
  }
  if (!result) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-sm text-muted">
        run code to see stdout, stderr, exit status and resource usage
      </div>
    );
  }

  const outcomeTone =
    result.outcome === "completed" ? (result.exitCode === 0 ? "ok" : "warn") : "bad";

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={outcomeTone}>{OUTCOME_LABEL[result.outcome]}</Badge>
        <Badge tone="muted">exit {result.exitCode ?? "—"}</Badge>
        <Badge tone="muted">{result.durationMs} ms</Badge>
        {result.fuelUsed != null && <Badge tone="muted">{result.fuelUsed.toLocaleString()} fuel</Badge>}
        {result.timedOut && <Badge tone="bad">timed out</Badge>}
        {result.oom && <Badge tone="bad">oom</Badge>}
        {result.outputTruncated && <Badge tone="warn">truncated</Badge>}
        <Badge tone="muted">backend: {result.backend}</Badge>
      </div>

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
      <div className="mb-1 text-[11px] uppercase tracking-widest text-muted">{title}</div>
      <pre
        className={`max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 text-[13px] leading-relaxed ${
          body ? (tone === "red" ? "text-red/90" : "text-foreground") : "text-muted"
        }`}
      >
        {body || empty}
      </pre>
    </div>
  );
}
