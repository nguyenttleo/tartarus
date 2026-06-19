"use client";

import { Prompt } from "@/components/terminal/Prompt";
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
      ? "text-accent border-accent/40 bg-accent/5"
      : tone === "warn"
        ? "text-amber border-amber/40 bg-amber/5"
        : tone === "bad"
          ? "text-red border-red/40 bg-red/5"
          : "text-muted border-border bg-surface-2/60";
  return <span className={`chip ${cls}`}>{children}</span>;
}

export function OutputPanel({ result, error }: { result: RunResult | null; error: string | null }) {
  if (error) {
    return (
      <div className="p-4">
        <pre className="screen whitespace-pre-wrap break-words p-3 font-mono text-sm text-red">
          <span className="text-red/70">✗ error:</span> {error}
        </pre>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="h-full overflow-auto p-4 font-mono text-sm leading-relaxed text-muted">
        <p>
          <Prompt /> run code to capture <span className="text-foreground">stdout</span>,{" "}
          <span className="text-foreground">stderr</span>, exit status &amp; resource usage
          <span className="prompt animate-blink"> █</span>
        </p>
      </div>
    );
  }

  const outcomeTone =
    result.outcome === "completed" ? (result.exitCode === 0 ? "ok" : "warn") : "bad";

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={outcomeTone}>{OUTCOME_LABEL[result.outcome]}</Badge>
        <Badge tone="muted">exit {result.exitCode ?? "-"}</Badge>
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
      <div className="mb-1.5 flex items-center gap-2 font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className={tone === "red" ? "text-red/80" : "text-accent/80"}>▍</span>
        {title}
      </div>
      <pre
        className={`screen max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[13px] leading-relaxed ${
          body ? (tone === "red" ? "text-red/90" : "text-foreground") : "text-faint"
        }`}
      >
        {body || empty}
      </pre>
    </div>
  );
}
