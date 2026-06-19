"use client";

import { Prompt } from "@/components/terminal/Prompt";
import type { RunResult } from "@/lib/types";

// Terminal-style view of the syscall/resource trace the host recorded while running the guest.
export function TracePanel({ result }: { result: RunResult | null }) {
  if (!result) {
    return (
      <div className="h-full overflow-auto p-4 font-mono text-sm leading-relaxed text-muted">
        <p>
          <Prompt /> trace of every syscall the code{" "}
          <em className="not-italic text-foreground">attempted</em> prints here
          <span className="prompt animate-blink"> █</span>
        </p>
      </div>
    );
  }
  if (result.trace.length === 0) {
    return (
      <div className="p-4 font-mono text-sm text-muted">
        <Prompt /> (no trace recorded)
      </div>
    );
  }

  return (
    <div className="screen m-3 overflow-auto p-2 font-mono text-[13px] leading-relaxed">
      {result.trace.map((e) => (
        <div
          key={e.seq}
          className={`flex items-start gap-3 rounded-sm px-2 py-1 transition-colors ${
            e.denied ? "bg-red/10 text-red" : "text-foreground/90 hover:bg-accent/5"
          }`}
        >
          <span className="w-14 shrink-0 text-right text-muted">{e.tMs}ms</span>
          <span className={`w-4 shrink-0 text-center ${e.denied ? "text-red" : "text-accent/70"}`}>
            {e.denied ? "✗" : "›"}
          </span>
          <span className={`w-36 shrink-0 ${e.denied ? "text-red/90" : "text-accent/80"}`}>{e.kind}</span>
          <span className="min-w-0 break-words text-muted">{e.detail}</span>
        </div>
      ))}
    </div>
  );
}
