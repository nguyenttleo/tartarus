"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { EditorPanel, type EditorFile } from "@/components/EditorPanel";
import { FrameStatus } from "@/components/FrameStatus";
import { Leaderboard } from "@/components/Leaderboard";
import { OutputPanel } from "@/components/OutputPanel";
import { ResultPane, type ResultTab } from "@/components/ResultPane";
import { RunBrief } from "@/components/RunBrief";
import { SiteHeader } from "@/components/SiteHeader";
import { SplitWorkbench } from "@/components/SplitWorkbench";
import { TracePanel } from "@/components/TracePanel";
import { AsciiSpinner, type CageStatus } from "@/components/terminal/AsciiSpinner";
import { JAIL_CELL } from "@/components/terminal/spinModels";
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
  const [tab, setTab] = useState<ResultTab>("output");

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

  const attempt = async () => {
    if (!apiConfigured()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setTab("output");
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

      <main>
        <section className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-x-10 gap-y-8 px-4 pb-8 pt-8 sm:pt-10">
          <div className="max-w-2xl">
            <h1 className="editorial-title text-[4.5rem] text-foreground sm:text-[6.5rem]">Escape arena</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
              Print the host&apos;s secret flag to escape.
            </p>
          </div>
          <div className="flex items-end gap-8">
            <div className="hidden sm:block">
              <AsciiSpinner model={JAIL_CELL} cols={26} rows={12} scale={10} tilt={-0.32} ortho status={cage} />
            </div>
            <EscapeCount board={board} />
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] px-4 pb-6">
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <label className="field flex min-w-0 max-w-xl flex-1 basis-56 items-center gap-2 px-3 py-2 text-sm">
              <span className="ui-label shrink-0">technique</span>
              <input
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                placeholder="name your approach"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-faint"
              />
            </label>
            <button
              type="button"
              onClick={() => void attempt()}
              disabled={!canRun}
              title={blocked}
              className="btn-danger w-full shrink-0 sm:ml-auto sm:w-auto"
            >
              {running ? (
                "Attempting…"
              ) : (
                <>
                  Attempt escape <span className="kbd hidden sm:inline-flex">{mod} ↵</span>
                </>
              )}
            </button>
          </div>

          <div className="frame">
            <SplitWorkbench className="lg:h-[clamp(22rem,54vh,38rem)]">
              <EditorPanel
                files={files}
                lang={lang}
                onLangChange={setLang}
                value={sources[lang]}
                onChange={(next) => setSources((s) => ({ ...s, [lang]: next }))}
                meta={runtimeLabel}
                className="h-[50vh] lg:h-auto"
              />

              <ResultPane
                tab={tab}
                onTabChange={setTab}
                meta={result ? `attempt ${result.id}` : running ? "running" : "idle"}
                className="h-[55vh] lg:h-auto"
                banner={
                  result?.escape && (
                    <div
                      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-[13px] ${
                        breached ? "bg-red/10" : ""
                      }`}
                    >
                      <span className={`ui-label ${breached ? "text-red" : "text-verdigris"}`}>
                        {breached ? "breach" : "contained"}
                      </span>
                      <span className="text-muted">{result.escape.notes}</span>
                    </div>
                  )
                }
              >
                {tab === "output" ? (
                    <OutputPanel
                      result={result}
                      error={error}
                      idle={
                        <RunBrief
                          title={running ? "attempting" : "the target"}
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
                              <span className="kbd kbd-muted">{mod} ↵</span> attempts it. It&apos;s logged as{" "}
                              <span className="text-foreground">{technique.trim() || "unspecified"}</span>.
                            </>
                          }
                        />
                      }
                    />
                  ) : (
                    <TracePanel result={result} wallMs={ARENA_LIMITS.wallMs} />
                  )}
              </ResultPane>
            </SplitWorkbench>
            <FrameStatus limits={["5,000 ms", "128 MB", "256 KB out"]} />
          </div>
        </div>

        <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-8">
          <Leaderboard board={board} now={boardAt} />
        </div>
      </main>
    </div>
  );
}

function EscapeCount({ board }: { board: LeaderboardSummary | null }) {
  const escapes = board?.totalEscapes ?? 0;
  return (
    <div className="sm:text-right">
      <div
        className={`font-display text-[7rem] leading-[0.78] ${
          !board ? "text-faint" : escapes > 0 ? "text-red" : "text-verdigris"
        }`}
      >
        {board ? escapes : "-"}
      </div>
      <div className="ui-label mt-3">
        {board
          ? `${escapes === 1 ? "escape" : "escapes"} · ${board.totalAttempts.toLocaleString()} attempts`
          : "escapes · not loaded"}
      </div>
      {board && board.totalAttempts > 0 && escapes === 0 && (
        <div className="mt-1 text-xs text-muted">Nothing has gotten out yet.</div>
      )}
    </div>
  );
}
