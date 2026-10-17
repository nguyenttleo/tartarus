import type { ReactNode } from "react";

export function FrameStatus({ limits }: { limits: ReactNode[] }) {
  return (
    <div className="status-bar">
      <span className="text-foreground">wasmtime</span>
      <span>wasi preview 1</span>
      <span className="status-bar-rule hidden sm:block" aria-hidden />
      <span className="hidden sm:inline">no network</span>
      <span className="hidden sm:inline">no host fs</span>
      <span className="hidden md:inline">empty env</span>
      <span className="ml-auto flex items-center gap-4 tabular-nums">
        {limits.map((limit, i) => (
          <span key={i}>{limit}</span>
        ))}
      </span>
    </div>
  );
}
