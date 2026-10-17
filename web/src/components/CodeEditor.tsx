"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import type { Language } from "@/lib/types";

const MONACO_LANG: Record<Language, string> = {
  python: "python",
  javascript: "javascript",
};

// Colours match the tokens in globals.css.
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("tartarus", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "ECE7DD" },
      { token: "identifier", foreground: "ECE7DD" },
      { token: "comment", foreground: "8A867D" },
      { token: "keyword", foreground: "C9A06D" },
      { token: "string", foreground: "A9B98C" },
      { token: "string.escape", foreground: "D5BC82" },
      { token: "number", foreground: "C99AA3" },
      { token: "regexp", foreground: "C99AA3" },
      { token: "type", foreground: "86B5A7" },
      { token: "type.identifier", foreground: "86B5A7" },
      { token: "tag", foreground: "D5BC82" },
      { token: "delimiter", foreground: "A29E95" },
      { token: "operator", foreground: "A29E95" },
    ],
    colors: {
      "editor.background": "#242423",
      "editor.foreground": "#ECE7DD",
      "editorGutter.background": "#20201F",
      "editorLineNumber.foreground": "#89867D",
      "editorLineNumber.activeForeground": "#F1EEE8",
      "editorCursor.foreground": "#C9A06D",
      "editor.selectionBackground": "#4D4539",
      "editor.inactiveSelectionBackground": "#393630",
      "editor.lineHighlightBackground": "#2C2B29",
      "editor.lineHighlightBorder": "#00000000",
      "editorWidget.background": "#32312E",
      "editorWidget.border": "#4A4741",
      "editorSuggestWidget.background": "#32312E",
      "editorSuggestWidget.border": "#4A4741",
      "editorSuggestWidget.selectedBackground": "#403E3A",
      "editorHoverWidget.background": "#32312E",
      "editorHoverWidget.border": "#4A4741",
      "editorIndentGuide.background1": "#3A3834",
      "editorIndentGuide.activeBackground1": "#6B5F50",
      "editorBracketHighlight.foreground1": "#C9A06D",
      "editorBracketHighlight.foreground2": "#C99AA3",
      "editorBracketHighlight.foreground3": "#86B5A7",
      "editorBracketMatch.background": "#C9A06D1F",
      "editorBracketMatch.border": "#C9A06D66",
      "scrollbarSlider.background": "#55534E80",
      "scrollbarSlider.hoverBackground": "#77736B99",
      "scrollbarSlider.activeBackground": "#77736BCC",
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
          Loading editor…
        </div>
      }
      options={{
        fontSize: 14,
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
