"use client";

import type { RunResult } from "@/lib/types";

// Terminal-style view of the syscall/resource trace the host recorded while running the guest.
export function TracePanel({ result }: { result: RunResult | null }) {
  if (!result) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-sm text-muted">
        the syscall-style trace of what the code <em className="px-1">attempted</em> appears here
      </div>
    );
  }
  if (result.trace.length === 0) {
    return <div className="p-4 text-sm text-muted">(no trace recorded)</div>;
  }

  return (
    <div className="h-full overflow-auto p-3 font-mono text-[12.5px] leading-relaxed">
      {result.trace.map((e) => (
        <div
          key={e.seq}
          className={`flex gap-3 border-b border-border/40 py-1 ${e.denied ? "text-red" : "text-foreground/90"}`}
        >
          <span className="w-14 shrink-0 text-right text-muted">{e.tMs}ms</span>
          <span className="w-4 shrink-0 text-center">{e.denied ? "✗" : "›"}</span>
          <span className="w-36 shrink-0 text-accent/80">{e.kind}</span>
          <span className="min-w-0 break-words text-muted">{e.detail}</span>
        </div>
      ))}
    </div>
  );
}
