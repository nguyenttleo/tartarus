"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import { Prompt } from "@/components/terminal/Prompt";
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
      "editor.background": "#060809",
      "editor.foreground": "#d6e0da",
      "editorLineNumber.foreground": "#55685e",
      "editorLineNumber.activeForeground": "#9fb4a8",
      "editorCursor.foreground": "#46f7a4",
      "editor.selectionBackground": "#1f7d5755",
      "editor.lineHighlightBackground": "#0c1116",
      "editorWidget.background": "#0b0f13",
      "editorIndentGuide.background1": "#16201b",
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
      loading={
        <div className="p-4 font-mono text-sm text-muted">
          <Prompt /> loading editor…<span className="prompt animate-blink"> █</span>
        </div>
      }
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
