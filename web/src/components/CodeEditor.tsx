"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import type { Language } from "@/lib/types";

const MONACO_LANG: Record<Language, string> = {
  python: "python",
  javascript: "javascript",
};

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("tartarus", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0b0f13",
      "editor.foreground": "#ccd6d0",
      "editorLineNumber.foreground": "#314039",
      "editorCursor.foreground": "#46f7a4",
      "editor.selectionBackground": "#1f7d5755",
      "editor.lineHighlightBackground": "#0f141a",
    },
  });
};

export function CodeEditor({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Editor
      height="100%"
      language={MONACO_LANG[language]}
      theme="tartarus"
      value={value}
      beforeMount={defineTheme}
      onChange={(v) => onChange(v ?? "")}
      loading={<div className="grid h-full place-items-center text-sm text-muted">loading editor…</div>}
      options={{
        fontSize: 13,
        fontFamily: "var(--font-jet), ui-monospace, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        smoothScrolling: true,
        tabSize: 2,
        renderLineHighlight: "line",
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
    />
  );
}
