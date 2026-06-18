"use client";

import { useCallback, useEffect, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { OutputPanel } from "@/components/OutputPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { TracePanel } from "@/components/TracePanel";
import { apiConfigured, getHealth, runAndWait } from "@/lib/api";
import { STARTERS } from "@/lib/snippets";
import type { Health, Language, Limits, RunResult } from "@/lib/types";

const FALLBACK_LANGS: { id: Language; label: string }[] = [
  { id: "python", label: "Python 3 (CPython · WASI)" },
  { id: "javascript", label: "JavaScript (QuickJS · WASI)" },
];

export default function IdePage() {
  const configured = apiConfigured();
  const [health, setHealth] = useState<Health | null>(null);
  const [lang, setLang] = useState<Language>("python");
  const [sources, setSources] = useState<Record<Language, string>>(STARTERS);
  const [stdin, setStdin] = useState("");
  const [wallMs, setWallMs] = useState(5000);
  const [memoryMb, setMemoryMb] = useState(128);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"output" | "trace">("output");

  useEffect(() => {
    let alive = true;
    getHealth().then((h) => {
      if (!alive) return;
      setHealth(h);
      if (h) {
        const first = h.languages.find((l) => l.available);
        if (first) {
          setLang((prev) => (h.languages.some((l) => l.id === prev && l.available) ? prev : first.id));
        }
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const langs = health?.languages ?? FALLBACK_LANGS.map((l) => ({ ...l, available: false }));
  const langAvailable = health?.languages.find((l) => l.id === lang)?.available ?? false;
  const canRun = configured && !!health && langAvailable && !running;

  const run = useCallback(async () => {
    if (!apiConfigured()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setTab("output");
    const limits: Limits = {
      wallMs,
      fuel: 10_000_000_000,
      memoryBytes: memoryMb * 1024 * 1024,
      outputBytes: 256 * 1024,
    };
    try {
      const res = await runAndWait(
        { lang, source: sources[lang], stdin, limits, mode: "normal" },
        { onStatus: setStatus }
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStatus("");
    }
  }, [lang, sources, stdin, wallMs, memoryMb]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!running) void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, running]);

  return (
    <div className="min-h-screen dotgrid">
      <SiteHeader active="ide" health={health} configured={configured} />

      {(!configured || !health) && (
        <div className="mx-auto max-w-[1400px] px-4 pt-3">
          <div className="rounded border border-amber/40 bg-amber/5 px-4 py-2 text-sm text-amber">
            {!configured
              ? "Backend not connected. Set NEXT_PUBLIC_TARTARUS_API to your Tartarus API URL, or run `tartarus all` locally and point this app at it."
              : "Backend is configured but not reachable. Is the Tartarus API running?"}
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-2">
        {/* Editor column */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
              aria-label="Language"
            >
              {langs.map((l) => (
                <option key={l.id} value={l.id} disabled={!l.available && !!health}>
                  {l.label}
                  {!l.available && !!health ? " (unavailable)" : ""}
                </option>
              ))}
            </select>

            <LimitSelect label="time" value={wallMs} onChange={setWallMs} options={[1000, 3000, 5000, 10000]} suffix="ms" />
            <LimitSelect label="mem" value={memoryMb} onChange={setMemoryMb} options={[64, 128, 256, 512]} suffix="MB" />

            <button
              onClick={() => void run()}
              disabled={!canRun}
              className="ml-auto rounded bg-accent px-4 py-1.5 text-sm font-semibold text-[#04130c] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? `running… ${status}` : "Run ▸  (⌘/Ctrl+Enter)"}
            </button>
          </div>

          <div className="panel flex h-[52vh] flex-col overflow-hidden">
            <div className="titlebar flex items-center gap-2 px-3 py-1.5 text-xs text-muted">
              <span className="prompt">~/sandbox</span> $ edit {lang === "python" ? "main.py" : "main.js"}
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                language={lang}
                value={sources[lang]}
                onChange={(next) => setSources((s) => ({ ...s, [lang]: next }))}
              />
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="titlebar px-3 py-1.5 text-xs text-muted">stdin</div>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="piped to the program's stdin…"
              spellCheck={false}
              className="h-20 w-full resize-y bg-transparent p-3 text-sm outline-none placeholder:text-muted"
            />
          </div>
        </section>

        {/* Result column */}
        <section className="panel flex h-[calc(52vh+9.5rem)] flex-col overflow-hidden">
          <div className="titlebar flex items-center gap-1 px-2 py-1 text-xs">
            <Tab label="output" active={tab === "output"} onClick={() => setTab("output")} />
            <Tab label="trace" active={tab === "trace"} onClick={() => setTab("trace")} />
            <span className="ml-auto px-2 text-muted">
              {result ? `run ${result.id}` : "idle"}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            {tab === "output" ? <OutputPanel result={result} error={error} /> : <TracePanel result={result} />}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 text-xs text-muted">
        Untrusted code runs as WebAssembly under wasmtime — no network, no host filesystem, hard CPU /
        memory / wall-clock / output caps, one ephemeral sandbox per run. Think you can break out?{" "}
        <a className="text-accent underline-offset-2 hover:underline" href="/arena">
          Try the Escape Arena →
        </a>
      </footer>
    </div>
  );
}

function LimitSelect({
  label,
  value,
  onChange,
  options,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: number[];
  suffix: string;
}) {
  return (
    <label className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent text-foreground outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
            {suffix}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 ${active ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}
