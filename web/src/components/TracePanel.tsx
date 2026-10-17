"use client";

import type { RunResult, TraceEvent } from "@/lib/types";

// Event kinds from tartarus-core/src/sandbox.rs.
function sampleTrace(wallMs: number): TraceEvent[] {
  return [
    { seq: 0, tMs: 0, kind: "sandbox.provision", detail: `backend=wasm wall=${wallMs}ms mem=134217728B`, denied: false },
    { seq: 1, tMs: 2, kind: "wasi.configure", detail: "env=none net=none; preopen /sandbox(ro) /tmp(rw)", denied: false },
    { seq: 2, tMs: 2, kind: "net.policy", detail: "no socket capability granted", denied: false },
    { seq: 3, tMs: 41, kind: "fd_write", detail: "stdout 27 bytes", denied: false },
    { seq: 4, tMs: wallMs + 1, kind: "limit.wallclock", detail: `guest killed after ~${wallMs + 1}ms (cap ${wallMs}ms)`, denied: true },
  ];
}

export function TracePanel({ result, wallMs = 5000 }: { result: RunResult | null; wallMs?: number }) {
  if (!result) {
    return (
      <div className="h-full overflow-auto p-4 text-[13px] leading-6">
        <p className="max-w-prose text-muted">
          No trace yet. Run the code to see the host log.
        </p>
        <div className="ui-label mb-1 mt-5">example</div>
        <div aria-hidden className="-mx-2 select-none opacity-50">
          {sampleTrace(wallMs).map((e) => (
            <TraceRow key={e.seq} event={e} />
          ))}
        </div>
      </div>
    );
  }
  if (result.trace.length === 0) {
    return <div className="p-4 font-mono text-[13px] text-faint">No trace recorded.</div>;
  }

  return (
    <div className="h-full overflow-auto p-3 font-mono text-[13px] leading-6">
      {result.trace.map((e) => (
        <TraceRow key={e.seq} event={e} />
      ))}
    </div>
  );
}

function TraceRow({ event: e }: { event: TraceEvent }) {
  return (
    <div className={`trace-row flex items-start gap-3 rounded-sm px-2 py-1 ${e.denied ? "trace-row-denied" : ""}`}>
      <span className="w-16 shrink-0 text-right tabular-nums text-faint">{e.tMs}ms</span>
      <span className={`w-36 shrink-0 ${e.denied ? "text-red" : "text-verdigris"}`}>{e.kind}</span>
      <span className="min-w-0 break-words text-foreground">{e.detail}</span>
    </div>
  );
}
