"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { PaneTabs } from "@/components/PaneTabs";
import type { Language } from "@/lib/types";

export type EditorFile = { lang: Language; name: string; disabled?: boolean };

// The file tabs select the language.
export function EditorPanel({
  files,
  lang,
  onLangChange,
  value,
  onChange,
  meta,
  className = "",
  children,
}: {
  files: EditorFile[];
  lang: Language;
  onLangChange: (lang: Language) => void;
  value: string;
  onChange: (next: string) => void;
  meta?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const baseId = useId();

  return (
    <div className={`flex min-w-0 flex-col overflow-hidden ${className}`}>
      <PaneTabs
        tabs={files.map((f) => ({
          id: f.lang,
          label: f.name,
          disabled: f.disabled,
          title: f.disabled ? "Runtime unavailable on this backend" : undefined,
        }))}
        value={lang}
        onChange={onLangChange}
        label="Source file"
        idPrefix={baseId}
        controls={`${baseId}-panel`}
        meta={meta}
      />
      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${lang}`}
        className="screen min-h-0 flex-1 overflow-hidden"
      >
        <CodeEditor language={lang} value={value} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

export function StdinDrawer({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (next: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const bytes = new TextEncoder().encode(value).length;
  return (
    <>
      <button
        type="button"
        className="drawer-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
      >
        <span className="drawer-chevron text-accent" aria-hidden>
          ›
        </span>
        <span className="ui-label text-inherit">stdin</span>
        <span className="ml-auto text-[11px] tabular-nums text-muted">
          {bytes === 0 ? "empty" : `${bytes} ${bytes === 1 ? "byte" : "bytes"}`}
        </span>
      </button>
      {open && (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type input for your program"
          spellCheck={false}
          autoFocus
          className="screen h-28 w-full shrink-0 resize-none border-t border-border p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-faint"
        />
      )}
    </>
  );
}
