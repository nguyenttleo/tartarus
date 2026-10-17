"use client";

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type PaneTab<T extends string> = { id: T; label: string; disabled?: boolean; title?: string };

// Arrow keys move between enabled tabs.
export function PaneTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  controls,
  meta,
}: {
  tabs: PaneTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  controls: string;
  meta?: ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const dir = event.key === "ArrowRight" ? 1 : -1;
    const current = tabs.findIndex((t) => t.id === value);
    for (let step = 1; step <= tabs.length; step++) {
      const i = (current + dir * step + tabs.length) % tabs.length;
      if (!tabs[i].disabled) {
        onChange(tabs[i].id);
        refs.current[i]?.focus();
        return;
      }
    }
  };

  return (
    <div className="tab-strip">
      <div className="flex items-stretch" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t, i) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={controls}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              title={t.title}
              onClick={() => onChange(t.id)}
              className="strip-tab"
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {meta && <span className="ml-auto min-w-0 self-center truncate px-3 text-[11px] text-muted">{meta}</span>}
    </div>
  );
}
