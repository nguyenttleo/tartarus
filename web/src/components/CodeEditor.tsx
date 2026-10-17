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
      { token: "", foreground: "EFEEEC" },
      { token: "identifier", foreground: "EFEEEC" },
      { token: "comment", foreground: "82807C" },
      { token: "keyword", foreground: "B9A9FF" },
      { token: "string", foreground: "E2B293" },
      { token: "string.escape", foreground: "D8D1FF" },
      { token: "number", foreground: "D8D1FF" },
      { token: "regexp", foreground: "D8D1FF" },
      { token: "type", foreground: "D6D1C3" },
      { token: "type.identifier", foreground: "D6D1C3" },
      { token: "tag", foreground: "E2B293" },
      { token: "delimiter", foreground: "B2B1AC" },
      { token: "operator", foreground: "B2B1AC" },
    ],
    colors: {
      "editor.background": "#32312E",
      "editor.foreground": "#EFEEEC",
      "editorGutter.background": "#32312E",
      "editorLineNumber.foreground": "#666461",
      "editorLineNumber.activeForeground": "#B2B1AC",
      "editorCursor.foreground": "#B9A9FF",
      "editor.selectionBackground": "#4D416B",
      "editor.inactiveSelectionBackground": "#40394E",
      "editor.lineHighlightBackground": "#363532",
      "editor.lineHighlightBorder": "#00000000",
      "editorWidget.background": "#3B3A38",
      "editorWidget.border": "#464542",
      "editorSuggestWidget.background": "#3B3A38",
      "editorSuggestWidget.border": "#464542",
      "editorSuggestWidget.selectedBackground": "#464542",
      "editorHoverWidget.background": "#3B3A38",
      "editorHoverWidget.border": "#464542",
      "editorIndentGuide.background1": "#3B3A38",
      "editorIndentGuide.activeBackground1": "#5C5B58",
      "editorBracketHighlight.foreground1": "#B9A9FF",
      "editorBracketHighlight.foreground2": "#E2B293",
      "editorBracketHighlight.foreground3": "#D8D1FF",
      "editorBracketMatch.background": "#795BCE26",
      "editorBracketMatch.border": "#B9A9FF66",
      "scrollbarSlider.background": "#5C5B5880",
      "scrollbarSlider.hoverBackground": "#78777499",
      "scrollbarSlider.activeBackground": "#787774CC",
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
        // The EditContext input lets the spacebar scroll the page.
        editContext: false,
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
