"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { EditorPanel, type EditorFile } from "@/components/EditorPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { OutputPanel } from "@/components/OutputPanel";
import { RunBrief } from "@/components/RunBrief";
import { SiteHeader } from "@/components/SiteHeader";
import { TracePanel } from "@/components/TracePanel";
import { CellPanel, Panel } from "@/components/Workbench";
import type { CageStatus } from "@/components/terminal/AsciiSpinner";
import { apiConfigured, backendState, getLeaderboard, runAndWait } from "@/lib/api";
import { ARENA_STARTERS } from "@/lib/snippets";
import type { Language, LeaderboardSummary, Limits, RunResult } from "@/lib/types";
import { useHealth } from "@/lib/useHealth";
import { useModKey } from "@/lib/useModKey";

const LANGS: Language[] = ["python", "javascript"];
const FILE_NAMES: Record<Language, string> = { python: "exploit.py", javascript: "exploit.js" };
const FALLBACK_LABELS: Record<Language, string> = {
  python: "Python 3 (CPython · WASI)",
  javascript: "JavaScript (QuickJS · WASI)",
};
const ARENA_LIMITS: Limits = {
  wallMs: 5000,
  fuel: 10_000_000_000,
  memoryBytes: 128 * 1024 * 1024,
  outputBytes: 256 * 1024,
};

export default function ArenaPage() {
  const configured = apiConfigured();
  const mod = useModKey();
  const { health, samples, refresh } = useHealth();
  const [board, setBoard] = useState<LeaderboardSummary | null>(null);
  const [boardAt, setBoardAt] = useState(0);
  const [picked, setLang] = useState<Language>("python");
  const [sources, setSources] = useState<Record<Language, string>>(ARENA_STARTERS);
  const [technique, setTechnique] = useState("read host filesystem");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBoard = useCallback(() => {
    getLeaderboard().then((b) => {
      setBoard(b);
      setBoardAt(Date.now());
    });
  }, []);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  // Use the first available runtime if the picked one is missing.
  const firstAvailable = health?.languages.find((l) => l.available)?.id;
  const lang =
    health && firstAvailable && !health.languages.some((l) => l.id === picked && l.available)
      ? firstAvailable
      : picked;

  const backend = backendState(configured, health);
  const langAvailable = health?.languages.find((l) => l.id === lang)?.available ?? false;
  const canRun = configured && !!health && langAvailable && !running;
  const blocked =
    backend === "unconfigured"
      ? "Backend not connected"
      : backend === "offline"
        ? "Backend offline"
        : backend === "checking"
          ? "Checking backend"
          : !langAvailable
            ? "Runtime unavailable"
            : undefined;

  const files: EditorFile[] = LANGS.map((id) => ({
    lang: id,
    name: FILE_NAMES[id],
    disabled: !!health && !health.languages.some((l) => l.id === id && l.available),
  }));
  const runtimeLabel = health?.languages.find((l) => l.id === lang)?.label ?? FALLBACK_LABELS[lang];
  const breached = result?.escape?.succeeded === true;
  const cage: CageStatus = running
    ? "running"
    : breached
      ? "breach"
      : result?.escape
        ? "ok"
        : error
          ? "bad"
          : "idle";
  const [stateText, stateClass] = running
    ? ["attempting", "text-accent-text"]
    : breached
      ? ["breach", "text-red"]
      : result?.escape
        ? ["contained", "text-ok"]
        : error
          ? ["error", "text-red"]
          : ["idle", undefined];

  const attempt = async () => {
    if (!apiConfigured()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runAndWait({ lang, source: sources[lang], mode: "arena", technique, limits: ARENA_LIMITS });
      setResult(res);
      refreshBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const onAttemptShortcut = useEffectEvent(() => {
    if (canRun) void attempt();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onAttemptShortcut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader active="arena" health={health} configured={configured} samples={samples} onRefresh={refresh} />

      <main className="mx-auto max-w-[1240px] px-6 pb-14 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-9">
          <div>
            <h1 className="page-title">Escape Arena</h1>
            <p className="mt-3 text-sm text-muted">Print the host&apos;s secret flag to escape.</p>
          </div>
          <div className="flex w-full flex-wrap items-end gap-6 sm:w-auto">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-72 sm:flex-none">
              <span className="ui-label">technique</span>
              <input
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                placeholder="name your approach"
                className="field h-9 px-3 text-xs outline-none placeholder:text-faint"
              />
            </label>
            <button type="button" onClick={() => void attempt()} disabled={!canRun} title={blocked} className="btn-danger">
              {running ? "attempting" : "attempt"}
              <span className="btn-hint">{mod} ↵</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <EditorPanel
            files={files}
            lang={lang}
            onLangChange={setLang}
            value={sources[lang]}
            onChange={(next) => setSources((s) => ({ ...s, [lang]: next }))}
            meta={runtimeLabel}
            className="panel h-[60vh] lg:col-span-8 lg:h-[600px]"
          />

          <div className="flex flex-col gap-6 lg:col-span-4 lg:h-[600px]">
            <CellPanel
              status={cage}
              className="shrink-0"
              rows={[
                ["state", stateText, stateClass],
                ["attempts", board ? board.totalAttempts.toLocaleString() : "-"],
              ]}
            >
              <EscapeCount board={board} />
            </CellPanel>
            <Panel
              title="output"
              meta={result ? `attempt ${result.id}` : undefined}
              className="min-h-[240px] flex-1 lg:min-h-0"
            >
              {result?.escape && (
                <div
                  className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-xs ${
                    breached ? "bg-red/10" : ""
                  }`}
                >
                  <span className={breached ? "text-red" : "text-ok"}>{breached ? "breach" : "contained"}</span>
                  <span className="text-muted">{result.escape.notes}</span>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto">
                <OutputPanel
                  result={result}
                  error={error}
                  idle={
                    <RunBrief
                      running={running}
                      backend={backend}
                      rows={[
                        ["flag", "a fresh TARTARUS_FLAG{…} per attempt, held by the host"],
                        ["escape", "the flag shows up in stdout or stderr"],
                        ["you get", "/sandbox read-only, /tmp writable, stdout, stderr"],
                        ["you don't", "network, environment variables, host paths"],
                      ]}
                      note={
                        <>
                          <span className="kbd">{mod} ↵</span> attempts it. It&apos;s logged as{" "}
                          <span className="text-foreground">{technique.trim() || "unspecified"}</span>.
                        </>
                      }
                    />
                  }
                />
              </div>
            </Panel>
          </div>

          <Panel title="trace" meta={result ? `${result.trace.length} events` : undefined} className="lg:col-span-12">
            <TracePanel result={result} wallMs={ARENA_LIMITS.wallMs} />
          </Panel>

          <Leaderboard board={board} now={boardAt} className="lg:col-span-12" />
        </div>
      </main>
    </div>
  );
}

function EscapeCount({ board }: { board: LeaderboardSummary | null }) {
  const escapes = board?.totalEscapes ?? 0;
  return (
    <div className="pb-7 text-right">
      <div
        className={`text-[56px] font-medium leading-none tabular-nums ${
          !board ? "text-faint" : escapes > 0 ? "text-red" : "text-ok"
        }`}
      >
        {board ? escapes : "-"}
      </div>
      <div className="ui-label mt-2">{escapes === 1 ? "escape" : "escapes"}</div>
    </div>
  );
}
