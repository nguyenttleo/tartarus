"use client";

import { useCallback, useEffect, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { OutputPanel } from "@/components/OutputPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { TracePanel } from "@/components/TracePanel";
import { apiConfigured, getHealth, getLeaderboard, runAndWait } from "@/lib/api";
import { ARENA_STARTERS } from "@/lib/snippets";
import type { Health, Language, LeaderboardSummary, RunResult } from "@/lib/types";

export default function ArenaPage() {
  const configured = apiConfigured();
  const [health, setHealth] = useState<Health | null>(null);
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
        <div className="panel mb-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-xl font-bold tracking-wide text-accent glow">The Escape Arena</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              A secret flag lives on the host, outside the sandbox. Write code that exfiltrates it. Every
              attempt is logged. The sandbox grants no network and no host filesystem — so far, nothing has
              gotten out.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent">
              {board ? board.totalEscapes : "—"}
              <span className="text-muted"> / {board ? board.totalAttempts : "—"}</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-muted">successful escapes / attempts</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Attempt column */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
                aria-label="Language"
              >
                {(health?.languages ?? []).map((l) => (
                  <option key={l.id} value={l.id} disabled={!l.available}>
                    {l.label}
                    {!l.available ? " (unavailable)" : ""}
                  </option>
                ))}
                {!health && <option value={lang}>{lang}</option>}
              </select>

              <input
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                placeholder="technique label"
                className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
                aria-label="Technique"
              />

              <button
                onClick={() => void attempt()}
                disabled={!canRun}
                className="rounded bg-red px-4 py-1.5 text-sm font-semibold text-[#1a0606] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? "attempting…" : "Attempt escape ▸"}
              </button>
            </div>

            <div className="panel flex h-[48vh] flex-col overflow-hidden">
              <div className="titlebar px-3 py-1.5 text-xs text-muted">
                <span className="prompt">~/arena</span> $ {lang === "python" ? "exploit.py" : "exploit.js"}
              </div>
              <div className="min-h-0 flex-1">
                <CodeEditor
                  language={lang}
                  value={sources[lang]}
                  onChange={(next) => setSources((s) => ({ ...s, [lang]: next }))}
                />
              </div>
            </div>

            {result?.escape && (
              <div
                className={`rounded border px-4 py-2 text-sm ${
                  breached ? "border-red/50 bg-red/10 text-red" : "border-accent/40 bg-accent/5 text-accent"
                }`}
              >
                {breached ? "⚠ BREACH — canary leaked!" : "✓ Contained"} · technique:{" "}
                {result.escape.technique} — {result.escape.notes}
              </div>
            )}
          </section>

          {/* Result column */}
          <section className="panel flex h-[calc(48vh+3rem)] flex-col overflow-hidden">
            <div className="titlebar flex items-center gap-1 px-2 py-1 text-xs">
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
          <div className="titlebar px-3 py-1.5 text-xs text-muted">hall of fame · attempts by technique</div>
          {board && board.techniques.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-4 py-2">technique</th>
                  <th className="px-4 py-2 text-right">attempts</th>
                  <th className="px-4 py-2 text-right">escapes</th>
                </tr>
              </thead>
              <tbody>
                {board.techniques.map((t) => (
                  <tr key={t.technique} className="border-t border-border/40">
                    <td className="px-4 py-2">{t.technique}</td>
                    <td className="px-4 py-2 text-right text-muted">{t.attempts}</td>
                    <td className={`px-4 py-2 text-right ${t.escapes > 0 ? "text-red" : "text-accent"}`}>
                      {t.escapes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-sm text-muted">No attempts recorded yet — be the first.</div>
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
      className={`rounded px-3 py-1 ${active ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}
