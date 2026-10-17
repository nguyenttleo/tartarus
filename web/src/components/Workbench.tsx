"use client";

import type { ReactNode } from "react";
import { AsciiSpinner, type CageStatus } from "@/components/terminal/AsciiSpinner";
import { JAIL_CELL } from "@/components/terminal/spinModels";

export function Panel({
  title,
  meta,
  className = "",
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <span className="panel-title">{title}</span>
          {meta && <span className="ml-auto min-w-0 truncate tabular-nums">{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Segmented({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="ui-label">{label}</span>
      <div role="group" aria-label={label} className="seg">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

// The cage over a table of readouts.
export function CellPanel({
  status,
  rows,
  className = "",
  children,
}: {
  status: CageStatus;
  rows: [string, ReactNode, string?][];
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Panel className={className}>
      <div className="flex flex-col items-center gap-5 px-5 pb-5 pt-6">
        <div className="flex w-full items-end justify-center gap-6">
          <AsciiSpinner model={JAIL_CELL} cols={30} rows={14} scale={12} tilt={-0.32} ortho status={status} />
          {children}
        </div>
        <dl className="readouts">
          {rows.map(([term, value, tone]) => (
            <div key={term} className="contents">
              <dt>{term}</dt>
              <dd className={tone}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}
