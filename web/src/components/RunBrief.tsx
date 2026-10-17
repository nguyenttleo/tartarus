import type { ReactNode } from "react";
import { API_BASE, type BackendState } from "@/lib/api";

export function RunBrief({
  rows,
  note,
  backend,
  running = false,
}: {
  rows?: [string, ReactNode][];
  note: ReactNode;
  backend: BackendState;
  running?: boolean;
}) {
  return (
    <div className="p-4 text-xs leading-6">
      {backend === "unconfigured" && (
        <p className="mb-3 text-amber">
          Not connected. Set NEXT_PUBLIC_TARTARUS_API in web/.env.local and restart the dev server.
        </p>
      )}
      {backend === "offline" && <p className="mb-3 text-red">No answer from {API_BASE}. Is the API running?</p>}

      {rows && (
        <dl className="mb-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1">
          {rows.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-faint">{term}</dt>
              <dd className="min-w-0 text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-faint">
        {running ? (
          <>
            running{" "}
            <span className="animate-blink text-accent-text" aria-hidden>
              ▍
            </span>
          </>
        ) : (
          note
        )}
      </p>
    </div>
  );
}
