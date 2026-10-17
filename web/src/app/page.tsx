"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { EditorPanel, StdinDrawer, type EditorFile } from "@/components/EditorPanel";
import { FrameStatus } from "@/components/FrameStatus";
import { OutputPanel, outcomeTone } from "@/components/OutputPanel";
import { ResultPane, type ResultTab } from "@/components/ResultPane";
import { RunBrief } from "@/components/RunBrief";
import { SiteHeader } from "@/components/SiteHeader";
import { SplitWorkbench } from "@/components/SplitWorkbench";
import { TracePanel } from "@/components/TracePanel";
import { AsciiSpinner, type CageStatus } from "@/components/terminal/AsciiSpinner";
import { Select } from "@/components/terminal/Select";
import { JAIL_CELL } from "@/components/terminal/spinModels";
import { apiConfigured, backendState, runAndWait } from "@/lib/api";
import { STARTERS } from "@/lib/snippets";
import type { Language, Limits, RunResult } from "@/lib/types";
import { useHealth } from "@/lib/useHealth";
import { useModKey } from "@/lib/useModKey";

const LANGS: Language[] = ["python", "javascript"];
const FILE_NAMES: Record<Language, string> = { python: "main.py", javascript: "main.js" };
const FALLBACK_LABELS: Record<Language, string> = {
  python: "Python 3 (CPython · WASI)",
  javascript: "JavaScript (QuickJS · WASI)",
};
const FUEL = 10_000_000_000;
const OUTPUT_BYTES = 256 * 1024;

export default function IdePage() {
  const configured = apiConfigured();
  const mod = useModKey();
  const { health, samples, refresh } = useHealth();
  const [picked, setLang] = useState<Language>("python");
  const [sources, setSources] = useState<Record<Language, string>>(STARTERS);
  const [stdin, setStdin] = useState("");
  const [stdinOpen, setStdinOpen] = useState(false);
  const [wallMs, setWallMs] = useState(5000);
  const [memoryMb, setMemoryMb] = useState(128);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ResultTab>("output");

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
  const cage: CageStatus = running ? "running" : result ? outcomeTone(result) : error ? "bad" : "idle";

  const run = async () => {
    if (!apiConfigured()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setTab("output");
    const limits: Limits = {
      wallMs,
      fuel: FUEL,
      memoryBytes: memoryMb * 1024 * 1024,
      outputBytes: OUTPUT_BYTES,
    };
    try {
      const res = await runAndWait(
        { lang, source: sources[lang], stdin, limits, mode: "normal" },
        { onStatus: setStatus },
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStatus("");
    }
  };

  const onRunShortcut = useEffectEvent(() => {
    if (canRun) void run();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onRunShortcut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader active="ide" health={health} configured={configured} samples={samples} onRefresh={refresh} />

      <section className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 pb-5 pt-6 sm:pt-8">
        <h1 className="editorial-title min-w-0 text-[2.5rem] normal-case text-foreground sm:text-[3.25rem]">
          Run sketchy code in isolation
        </h1>
        <div className="hidden shrink-0 md:block">
          <AsciiSpinner model={JAIL_CELL} cols={20} rows={9} scale={8} tilt={-0.32} ortho status={cage} />
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <LimitSelect label="time" value={wallMs} onChange={setWallMs} options={[1000, 3000, 5000, 10000]} suffix="ms" />
          <LimitSelect label="mem" value={memoryMb} onChange={setMemoryMb} options={[64, 128, 256, 512]} suffix="MB" />
          <button
            type="button"
            onClick={() => void run()}
            disabled={!canRun}
            title={blocked}
            className="btn-accent ml-auto shrink-0"
          >
            {running ? (
              status === "queued" ? "Queued…" : "Running…"
            ) : (
              <>
                Run <span className="kbd hidden sm:inline-flex">{mod} ↵</span>
              </>
            )}
          </button>
        </div>

        <div className="frame">
          <SplitWorkbench className="lg:h-[clamp(24rem,59vh,42rem)]">
            <EditorPanel
              files={files}
              lang={lang}
              onLangChange={setLang}
              value={sources[lang]}
              onChange={(next) => setSources((s) => ({ ...s, [lang]: next }))}
              meta={runtimeLabel}
              className="h-[55vh] lg:h-auto"
            >
              <StdinDrawer value={stdin} onChange={setStdin} open={stdinOpen} onOpenChange={setStdinOpen} />
            </EditorPanel>

            <ResultPane
              tab={tab}
              onTabChange={setTab}
              meta={result ? `run ${result.id}` : running ? "running" : "idle"}
              className="h-[55vh] lg:h-auto"
            >
              {tab === "output" ? (
                  <OutputPanel
                    result={result}
                    error={error}
                    idle={
                      <RunBrief
                        title={running ? `running ${FILE_NAMES[lang]}` : `next run · ${FILE_NAMES[lang]}`}
                        running={running}
                        backend={backend}
                        rows={[
                          ["wall clock", `${wallMs.toLocaleString()} ms`],
                          ["memory", `${memoryMb} MB`],
                          ["cpu fuel", `${FUEL.toLocaleString()} units`],
                          ["output", "256 KB per stream"],
                        ]}
                        note={
                          <>
                            <span className="kbd kbd-muted">{mod} ↵</span> runs it.
                          </>
                        }
                      />
                    }
                  />
                ) : (
                  <TracePanel result={result} wallMs={wallMs} />
                )}
            </ResultPane>
          </SplitWorkbench>
          <FrameStatus limits={[`${wallMs.toLocaleString()} ms`, `${memoryMb} MB`, "256 KB out"]} />
        </div>
      </main>

      <footer className="mx-auto max-w-[1200px] px-4 pb-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-muted">
          <a className="link-accent" href="https://github.com/nguyenttleo/tartarus">
            source
          </a>
          <Link className="link-accent ml-auto" href="/arena">
            Think it leaks? Try the escape arena
          </Link>
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
      options={options.map((o) => ({
        value: String(o),
        label: `${o}${suffix}`,
      }))}
      className="shrink-0"
    />
  );
}
