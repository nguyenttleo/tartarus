"use client";

import { useCallback, useEffect, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { OutputPanel } from "@/components/OutputPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { TracePanel } from "@/components/TracePanel";
import { AsciiSpinner } from "@/components/terminal/AsciiSpinner";
import { GlitchText } from "@/components/terminal/GlitchText";
import { Prompt } from "@/components/terminal/Prompt";
import { Select } from "@/components/terminal/Select";
import { JAIL_CELL } from "@/components/terminal/spinModels";
import { Ticker } from "@/components/terminal/Ticker";
import { apiConfigured, getHealth, runAndWait } from "@/lib/api";
import { STARTERS } from "@/lib/snippets";
import type { Health, Language, Limits, RunResult } from "@/lib/types";

const FALLBACK_LANGS: { id: Language; label: string }[] = [
  { id: "python", label: "Python 3 (CPython · WASI)" },
  { id: "javascript", label: "JavaScript (QuickJS · WASI)" },
];

const GUARANTEES = [
  "no network",
  "no host filesystem",
  "no ambient authority",
  "cpu fuel-metered",
  "epoch wall-clock kill",
  "memory ResourceLimiter",
  "output capped 256K",
  "one ephemeral store / run",
  "cpython · wasi",
  "quickjs · wasi",
  "syscall-style trace",
  "host canary never shared",
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
          <div className="flex items-start gap-2.5 rounded-lg border border-amber/40 bg-amber/5 px-4 py-2.5 text-sm text-amber">
            <span aria-hidden className="mt-0.5 text-amber/80">▲</span>
            <span>
              {!configured
                ? "Backend not connected. Set NEXT_PUBLIC_TARTARUS_API to your Tartarus API URL, or run `tartarus all` locally and point this app at it."
                : "Backend is configured but not reachable. Is the Tartarus API running?"}
            </span>
          </div>
        </div>
      )}

      {/* Hero - the console boots into a sandbox prompt */}
      <section className="mx-auto max-w-[1400px] px-4 pt-5">
        <div className="panel overflow-hidden">
          <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
            <span className="win-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="font-mono">hacker@tartarus: ~ - tartarus-shell</span>
          </div>
          <div className="flex items-center justify-between gap-6 px-5 py-6 sm:px-7">
            <div className="min-w-0">
              <div className="font-mono text-sm">
                <Prompt /> <span className="text-muted">./tartarus run --isolate wasm</span>
              </div>
              <GlitchText as="h1" className="mt-2 text-5xl leading-none tracking-tight sm:text-6xl">
                TARTARUS
              </GlitchText>
              <p className="mt-2 font-terminal text-sm uppercase tracking-[0.2em] text-accent">
                secure code execution sandbox
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Run untrusted, attacker-controlled code as WebAssembly under wasmtime - no network, no host
                filesystem, no ambient authority. Hard CPU / memory / wall-clock / output caps, and a live
                syscall-style trace of everything it tried.
              </p>
            </div>
            <div className="relative hidden w-[18rem] shrink-0 self-stretch lg:block" aria-hidden>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-start overflow-hidden">
                <AsciiSpinner model={JAIL_CELL} cols={36} rows={19} scale={15} tilt={-0.32} ortho />
              </div>
            </div>
          </div>
          <div className="border-t border-border py-2">
            <Ticker items={GUARANTEES} />
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-2">
        {/* Editor column */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              ariaLabel="Language"
              value={lang}
              onChange={(v) => setLang(v as Language)}
              options={langs.map((l) => ({
                value: l.id,
                label: !l.available && !!health ? `${l.label} (unavailable)` : l.label,
                disabled: !l.available && !!health,
              }))}
            />

            <LimitSelect label="time" value={wallMs} onChange={setWallMs} options={[1000, 3000, 5000, 10000]} suffix="ms" />
            <LimitSelect label="mem" value={memoryMb} onChange={setMemoryMb} options={[64, 128, 256, 512]} suffix="MB" />

            <button onClick={() => void run()} disabled={!canRun} className="btn-accent ml-auto">
              {running ? `running… ${status}` : "Run ▸  ⌘/Ctrl+Enter"}
            </button>
          </div>

          <div className="panel flex h-[52vh] flex-col overflow-hidden">
            <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
              <span className="win-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="font-mono">
                <span className="prompt">~/sandbox</span> $ edit {lang === "python" ? "main.py" : "main.js"}
              </span>
            </div>
            <div className="screen min-h-0 flex-1 overflow-hidden rounded-none border-0">
              <CodeEditor
                language={lang}
                value={sources[lang]}
                onChange={(next) => setSources((s) => ({ ...s, [lang]: next }))}
              />
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="titlebar flex items-center gap-2 px-3 py-2 text-xs text-muted">
              <span className="text-accent/70" aria-hidden>
                ▍
              </span>
              <span className="font-mono">stdin</span>
            </div>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="piped to the program's stdin…"
              spellCheck={false}
              className="screen h-20 w-full resize-y rounded-none border-x-0 border-b-0 border-t border-border p-3 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted"
            />
          </div>
        </section>

        {/* Result column */}
        <section className="panel flex h-[calc(52vh+9.5rem)] flex-col overflow-hidden">
          <div className="titlebar flex items-center gap-1 px-2 py-1.5 text-xs">
            <Tab label="output" active={tab === "output"} onClick={() => setTab("output")} />
            <Tab label="trace" active={tab === "trace"} onClick={() => setTab("trace")} />
            <span className="ml-auto px-2 font-mono text-[11px] text-muted">
              {result ? `run ${result.id}` : "idle"}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            {tab === "output" ? <OutputPanel result={result} error={error} /> : <TracePanel result={result} />}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 font-terminal text-xs text-muted">
          <span className="bg-accent px-2 py-0.5 font-bold text-background">NORMAL</span>
          <span className="text-foreground">hacker@tartarus</span>
          <span className="text-accent/70">wasmtime/WASI</span>
          <span className="hidden sm:inline">- untrusted code, contained · no net · no fs · metered cpu/mem · ephemeral store</span>
          <a className="link-accent ml-auto" href="/arena">
            attempt escape →
          </a>
        </div>
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
    <Select
      ariaLabel={label}
      label={label}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={options.map((o) => ({ value: String(o), label: `${o}${suffix}` }))}
    />
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 font-terminal transition-colors ${
        active ? "prompt glow" : "text-muted hover:text-accent"
      }`}
    >
      {active ? `[${label}]` : label}
    </button>
  );
}
