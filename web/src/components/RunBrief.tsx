import type { ReactNode } from "react";
import { API_BASE, type BackendState } from "@/lib/api";

export function RunBrief({
  title,
  rows,
  note,
  backend,
  running = false,
}: {
  title: string;
  rows: [string, ReactNode][];
  note: ReactNode;
  backend: BackendState;
  running?: boolean;
}) {
  return (
    <div className="h-full overflow-auto p-4 text-[13px] leading-6">
      {backend === "unconfigured" && (
        <p className="mb-4 text-amber">
          Not connected. Set NEXT_PUBLIC_TARTARUS_API in web/.env.local and restart the dev server.
        </p>
      )}
      {backend === "offline" && (
        <p className="mb-4 text-red">No answer from {API_BASE}. Is the API running?</p>
      )}

      <div className="ui-label flex items-center gap-2">
        {title}
        {running && (
          <span className="animate-blink text-accent" aria-hidden>
            ▍
          </span>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-0.5">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="min-w-0 text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-muted">{note}</p>
    </div>
  );
}
