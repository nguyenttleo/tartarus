"use client";

import type { RunResult, TraceEvent } from "@/lib/types";

// Event kinds from tartarus-core/src/sandbox.rs.
function sampleTrace(wallMs: number): TraceEvent[] {
  return [
    { seq: 0, tMs: 0, kind: "sandbox.provision", detail: `backend=wasm wall=${wallMs}ms mem=134217728B`, denied: false },
    { seq: 1, tMs: 2, kind: "wasi.configure", detail: "env=none net=none; preopen /sandbox(ro) /tmp(rw)", denied: false },
    { seq: 2, tMs: 2, kind: "net.policy", detail: "no socket capability granted", denied: false },
    { seq: 3, tMs: 3, kind: "guest.start", detail: "instantiate + call _start", denied: false },
    { seq: 4, tMs: 41, kind: "fd_write", detail: "stdout 27 bytes", denied: false },
    { seq: 5, tMs: wallMs + 1, kind: "limit.wallclock", detail: `guest killed after ~${wallMs + 1}ms (cap ${wallMs}ms)`, denied: true },
  ];
}

export function TracePanel({ result, wallMs = 5000 }: { result: RunResult | null; wallMs?: number }) {
  if (!result) {
    return (
      <div className="px-4 pb-4 pt-3 text-xs">
        <p className="text-muted">No trace yet. Run the code to see the host log.</p>
        <div className="ui-label mb-1 mt-4">example</div>
        <div aria-hidden className="select-none opacity-50">
          <Waterfall events={sampleTrace(wallMs)} />
        </div>
      </div>
    );
  }
  if (result.trace.length === 0) {
    return <p className="p-4 text-xs text-faint">No trace recorded.</p>;
  }
  return (
    <div className="px-4 pb-3 pt-1 text-xs">
      <Waterfall events={result.trace} />
    </div>
  );
}

function Waterfall({ events }: { events: TraceEvent[] }) {
  const total = Math.max(1, ...events.map((e) => e.tMs));
  const start = events.find((e) => e.kind === "guest.start")?.tMs;
  const end = events.find((e) => e.kind === "guest.exit")?.tMs ?? events.at(-1)?.tMs;
  const pct = (ms: number) => `${(ms / total) * 100}%`;

  return (
    <div>
      <div className="trace-row trace-axis">
        <span />
        <span className="trace-track flex justify-between border-l-0">
          <span>0 ms</span>
          <span>{Math.round(total / 2).toLocaleString()} ms</span>
          <span>{total.toLocaleString()} ms</span>
        </span>
        <span>event</span>
        <span>detail</span>
      </div>
      {events.map((e) => (
        <div key={e.seq} className={`trace-row font-mono ${e.denied ? "trace-row-denied" : ""}`}>
          <span className="text-right tabular-nums text-faint">{e.tMs.toLocaleString()} ms</span>
          <span className="trace-track">
            {start !== undefined && end !== undefined && end > start && (
              <span className="trace-band" style={{ left: pct(start), width: pct(end - start) }} />
            )}
            <span
              className="trace-mark"
              data-guest={start !== undefined && e.tMs >= start}
              data-denied={e.denied}
              style={{ left: pct(e.tMs) }}
            />
          </span>
          <span className={e.denied ? "text-red" : "text-foreground"}>{e.kind}</span>
          <span className="min-w-0 break-words text-muted">{e.detail}</span>
        </div>
      ))}
    </div>
  );
}
