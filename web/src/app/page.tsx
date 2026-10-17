"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { EditorPanel, StdinDrawer, type EditorFile } from "@/components/EditorPanel";
import { OutputPanel, TONE_CLASS, outcomeText, outcomeTone } from "@/components/OutputPanel";
import { RunBrief } from "@/components/RunBrief";
import { SiteHeader } from "@/components/SiteHeader";
import { TracePanel } from "@/components/TracePanel";
import { CellPanel, Panel, Segmented } from "@/components/Workbench";
import type { CageStatus } from "@/components/terminal/AsciiSpinner";
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
  const [stateText, stateClass] = running
    ? [status === "queued" ? "queued" : "running", "text-accent-text"]
    : result
      ? [outcomeText(result), TONE_CLASS[outcomeTone(result)]]
      : error
        ? ["error", "text-red"]
        : ["idle", undefined];

  const run = async () => {
    if (!apiConfigured()) return;
    setRunning(true);
    setError(null);
    setResult(null);
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

      <main className="mx-auto max-w-[1240px] px-6 pb-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-9">
          <h1 className="page-title">WASM Sandbox</h1>
          <div className="flex flex-wrap items-end gap-6">
            <Segmented
              label="wall"
              options={[1000, 3000, 5000, 10000]}
              value={wallMs}
              onChange={setWallMs}
              format={(n) => `${n / 1000}s`}
            />
            <Segmented label="mem" options={[64, 128, 256, 512]} value={memoryMb} onChange={setMemoryMb} format={String} />
            <button type="button" onClick={() => void run()} disabled={!canRun} title={blocked} className="btn-accent">
              {running ? (status === "queued" ? "queued" : "running") : "run"}
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
          >
            <StdinDrawer value={stdin} onChange={setStdin} open={stdinOpen} onOpenChange={setStdinOpen} />
          </EditorPanel>

          <div className="flex flex-col gap-6 lg:col-span-4 lg:h-[600px]">
            <CellPanel
              status={cage}
              className="shrink-0"
              rows={[
                ["state", stateText, stateClass],
                ["wall", `${wallMs.toLocaleString()} ms`],
                ["mem", `${memoryMb} MB`],
              ]}
            />
            <Panel
              title="output"
              meta={result ? `run ${result.id}` : undefined}
              className="min-h-[240px] flex-1 lg:min-h-0"
            >
              <div className="min-h-0 flex-1 overflow-auto">
                <OutputPanel
                  result={result}
                  error={error}
                  idle={
                    <RunBrief
                      running={running}
                      backend={backend}
                      note={
                        <>
                          No output yet. <span className="kbd">{mod} ↵</span> runs {FILE_NAMES[lang]}.
                        </>
                      }
                    />
                  }
                />
              </div>
            </Panel>
          </div>

          <Panel title="trace" meta={result ? `${result.trace.length} events` : undefined} className="lg:col-span-12">
            <TracePanel result={result} wallMs={wallMs} />
          </Panel>
        </div>
      </main>

      <footer className="mx-auto max-w-[1240px] px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pb-10 pt-4 text-[11px] text-faint">
          <span>wasmtime · wasi preview 1</span>
          <a className="link-accent" href="https://github.com/nguyenttleo/tartarus">
            source
          </a>
          <Link className="link-accent ml-auto" href="/arena">
            escape arena →
          </Link>
        </div>
      </footer>
    </div>
  );
}
