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
import { MAGNIFIER } from "@/components/terminal/spinModels";
import { Ticker } from "@/components/terminal/Ticker";
import { apiConfigured, getHealth, getLeaderboard, runAndWait } from "@/lib/api";
import { ARENA_STARTERS } from "@/lib/snippets";
import type { Health, Language, LeaderboardSummary, RunResult } from "@/lib/types";

const ARENA_FACTS = [
  "canary lives on the host",
  "never handed to the guest",
  "no sockets",
  "no host fs",
  "if it leaks into output → BREACH",
  "every attempt is logged",
  "leaderboard by technique",
  "wasmtime/wasi containment",
];

export default function ArenaPage() {
  const configured = apiConfigured();
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [board, setBoard] = useState<LeaderboardSummary | null>(null);
  const [lang, setLang] = useState<Language>("python");
  const [sources, setSources] = useState<Record<Language, string>>(ARENA_STARTERS);
  const [technique, setTechnique] = useState("read host filesystem");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"output" | "trace">("output");

  const refreshBoard = useCallback(() => {
    getLeaderboard().then(setBoard);
  }, []);

  useEffect(() => {
    let alive = true;
    getHealth().then((h) => {
      if (!alive) return;
      setHealth(h);
      if (h) {
        const first = h.languages.find((l) => l.available);
        if (first) setLang((p) => (h.languages.some((l) => l.id === p && l.available) ? p : first.id));
      }
    });
    refreshBoard();
    return () => {
      alive = false;
    };
  }, [refreshBoard]);

  const langAvailable = health?.languages.find((l) => l.id === lang)?.available ?? false;
  const canRun = configured && !!health && langAvailable && !running;

  const attempt = useCallback(async () => {
    if (!apiConfigured()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setTab("output");
    try {
      const res = await runAndWait({
        lang,
        source: sources[lang],
        mode: "arena",
        technique,
        limits: { wallMs: 5000, fuel: 10_000_000_000, memoryBytes: 128 * 1024 * 1024, outputBytes: 256 * 1024 },
      });
      setResult(res);
      refreshBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [lang, sources, technique, refreshBoard]);

  const breached = result?.escape?.succeeded === true;

  return (
    <div className="min-h-screen dotgrid">
      <SiteHeader active="arena" health={health} configured={configured} />

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Headline */}
        <div className="panel mb-4 overflow-hidden">
          <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
            <span className="win-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="font-mono">hacker@tartarus: ~/arena - breakout</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6 p-6">
            <div className="min-w-0">
              <div className="font-mono text-sm">
                <Prompt cwd="~/arena" /> <span className="text-muted">cat /host/canary &amp;&amp; exfil</span>
              </div>
              <GlitchText as="h1" className="mt-2 text-4xl leading-none tracking-tight sm:text-5xl">
                ESCAPE_ARENA
              </GlitchText>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                A secret flag lives on the host, outside the sandbox. Write code that exfiltrates it. Every
                attempt is logged. The guest gets no network and no host filesystem -{" "}
                <span className="text-accent">so far, nothing has gotten out.</span>
              </p>
            </div>
            <div className="relative hidden w-[14rem] shrink-0 self-stretch xl:block" aria-hidden>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <AsciiSpinner model={MAGNIFIER} cols={32} rows={16} scale={16} yoff={-0.05} />
              </div>
            </div>
            <div className="shrink-0 border border-border bg-black/30 px-5 py-3 text-right">
              <div className="font-display text-5xl leading-none">
                <span className={board && board.totalEscapes > 0 ? "text-red glow-strong" : "text-accent glow"}>
                  {board ? board.totalEscapes : "-"}
                </span>
                <span className="text-faint"> / {board ? board.totalAttempts : "-"}</span>
              </div>
              <div className="mt-2 font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">
                escapes / attempts
              </div>
            </div>
          </div>
          <div className="border-t border-border py-2">
            <Ticker items={ARENA_FACTS} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Attempt column */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                ariaLabel="Language"
                value={lang}
                onChange={(v) => setLang(v as Language)}
                options={
                  (health?.languages ?? []).length === 0
                    ? [{ value: lang, label: lang }]
                    : (health?.languages ?? []).map((l) => ({
                        value: l.id,
                        label: l.available ? l.label : `${l.label} (unavailable)`,
                        disabled: !l.available,
                      }))
                }
              />

              <input
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                placeholder="technique label"
                className="field min-w-0 flex-1 px-3 py-2 text-sm placeholder:text-muted"
                aria-label="Technique"
              />

              <button onClick={() => void attempt()} disabled={!canRun} className="btn-danger">
                {running ? "attempting…" : "Attempt escape ▸"}
              </button>
            </div>

            <div className="panel flex h-[48vh] flex-col overflow-hidden">
              <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
                <span className="win-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="font-mono">
                  <span className="prompt">~/arena</span> $ {lang === "python" ? "exploit.py" : "exploit.js"}
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

            {result?.escape && (
              <div
                className={`flex flex-wrap items-center gap-x-2 border px-4 py-2.5 font-mono text-sm ${
                  breached ? "border-red/50 bg-red/10 text-red" : "border-accent/40 bg-accent/5 text-accent"
                }`}
              >
                <span className="font-bold">
                  {breached ? "⚠ BREACH - canary leaked!" : "✓ CONTAINED"}
                </span>
                <span className="text-muted">
                  · technique: {result.escape.technique} - {result.escape.notes}
                </span>
              </div>
            )}
          </section>

          {/* Result column */}
          <section className="panel flex h-[calc(48vh+3rem)] flex-col overflow-hidden">
            <div className="titlebar flex items-center gap-1 px-2 py-1.5 text-xs">
              <TabBtn label="output" active={tab === "output"} onClick={() => setTab("output")} />
              <TabBtn label="trace" active={tab === "trace"} onClick={() => setTab("trace")} />
            </div>
            <div className="min-h-0 flex-1">
              {tab === "output" ? <OutputPanel result={result} error={error} /> : <TracePanel result={result} />}
            </div>
          </section>
        </div>

        {/* Leaderboard */}
        <section className="panel mt-4 overflow-hidden">
          <div className="titlebar flex items-center gap-2 px-3 py-2 font-terminal text-xs uppercase tracking-wider text-muted">
            <span className="text-accent/70" aria-hidden>
              ▚
            </span>
            ~/arena/leaderboard · attempts by technique
          </div>
          {board && board.techniques.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-surface-2/50 text-left font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">technique</th>
                  <th className="px-4 py-2.5 text-right font-medium">attempts</th>
                  <th className="px-4 py-2.5 text-right font-medium">escapes</th>
                </tr>
              </thead>
              <tbody>
                {board.techniques.map((t) => (
                  <tr key={t.technique} className="border-t border-border/40 transition-colors hover:bg-surface-2/40">
                    <td className="px-4 py-2.5 font-mono text-foreground">{t.technique}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">{t.attempts}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        t.escapes > 0 ? "text-red" : "text-accent/80"
                      }`}
                    >
                      {t.escapes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-sm text-muted">No attempts recorded yet - be the first.</div>
          )}
        </section>
      </main>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
