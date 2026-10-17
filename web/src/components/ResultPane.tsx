"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { PaneTabs } from "@/components/PaneTabs";

export type ResultTab = "output" | "trace";

const TABS = [
  { id: "output" as const, label: "output" },
  { id: "trace" as const, label: "trace" },
];

export function ResultPane({
  tab,
  onTabChange,
  meta,
  banner,
  className = "",
  children,
}: {
  tab: ResultTab;
  onTabChange: (tab: ResultTab) => void;
  meta?: ReactNode;
  banner?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`flex min-w-0 flex-col ${className}`}>
      <PaneTabs
        tabs={TABS}
        value={tab}
        onChange={onTabChange}
        label="Run result"
        idPrefix={id}
        controls={`${id}-panel`}
        meta={meta}
      />
      {banner}
      <div
        key={tab}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab}`}
        className="console-viewport pane-reveal min-h-0 flex-1"
      >
        {children}
      </div>
    </section>
  );
}
