"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Database,
  Download,
  FileJson,
  Flag,
  Flame,
  KeyRound,
  Lock,
  type LucideIcon,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  Send,
  Server,
  Terminal,
  Trophy,
  UnlockKeyhole,
  UserPlus,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { apiConfigured, getHealth } from "@/lib/api";
import {
  type ActionArtifact,
  type BoardResponse,
  type ChallengeActionResponse,
  type ChallengeView,
  type EventResponse,
  type PublicChallenge,
  type ScoreboardEntry,
  type SolveView,
  createLabyrinthTeam,
  exportLabyrinthState,
  getLabyrinthBoard,
  getLabyrinthEvent,
  launchLabyrinthInstance,
  runLabyrinthAction,
  submitLabyrinthFlag,
  unlockLabyrinthHint,
} from "@/lib/labyrinth";
import type { Health } from "@/lib/types";
import { GlitchText } from "@/components/terminal/GlitchText";
import { Ticker } from "@/components/terminal/Ticker";

const TEAM_KEY = "labyrinth.tartarusUi.teamId";
const LEGACY_TEAM_KEYS = ["labyrinth.teamId"];

const LABYRINTH_FACTS = [
  "six-stage leoOS intrusion",
  "dynamic hmac flags",
  "per-team challenge capsules",
  "sequential kill-chain gates",
  "hint costs affect score",
  "first blood tracked",
  "shared flag fingerprinting",
  "rate-limited submissions",
  "json export for operators",
  "tartarus-hosted ctf",
];

const PUBLIC_CHALLENGE_DESCRIPTIONS: Record<string, string> = {
  "parser-poltergeist":
    "LeoOS lets employees upload avatar images. The edge validator checks PNG magic bytes, while the thumbnail worker later sniffs markup and renders SVG.",
  "prompt-circumstance":
    "A LeoOS support agent summarizes tickets and reads attachments. Its hidden operator note contains your stage flag, and a regex redacts raw flag output.",
  "hendersons-gambit":
    "LeoOS runs a custom UCI chess engine for game analysis. A dormant debug personality is reachable through an option sequence, and the FEN parser trusts one buffer too far.",
  desync:
    "The LeoOS ops scratchpad syncs over a compact WebSocket operation format. Text edits are validated, but role and state ops were only meant for trusted replicas.",
  "schrodingers-session":
    "A one-time recovery token should mint exactly one admin session. The check and decrement happen on opposite sides of an async boundary.",
  "cold-boot":
    "The final LeoOS implant installer accepts license keys verified by LeoVM, a tiny 16-instruction bytecode machine with one self-modifying opcode.",
};

type Notice = {
  tone: "ok" | "warn" | "bad" | "muted";
  text: string;
} | null;

type ChallengeStatus = "solved" | "open" | "locked";

export default function LabyrinthPage() {
  const configured = apiConfigured();
  const [health, setHealth] = useState<Health | null>(null);
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const teamId = useStoredTeamId();
  const [teamName, setTeamName] = useState("red-team-one");
  const [handle, setHandle] = useState("operator");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  const [flagInput, setFlagInput] = useState("");
  const [actionResult, setActionResult] = useState<{
    slug: string;
    result: ChallengeActionResponse;
  } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    clearLegacyTeamIds();
  }, []);

  useEffect(() => {
    let alive = true;
    getHealth().then((h) => {
      if (alive) setHealth(h);
    });
    getLabyrinthEvent().then((e) => {
      if (alive) setEvent(e);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refreshBoard = useCallback(
    async (id = teamId) => {
      if (!configured || !id) return;
      const next = await getLabyrinthBoard(id);
      if (readTeamId() !== id) return;
      setBoard(next);
      setSelectedSlug((current) => {
        if (current && next.challenges.some((c) => c.slug === current)) return current;
        return pickChallenge(next)?.slug ?? null;
      });
    },
    [configured, teamId]
  );

  useEffect(() => {
    if (!teamId || !configured) return;
    let cancelled = false;
    window.setTimeout(() => {
      if (cancelled) return;
      refreshBoard(teamId).catch((error: unknown) => {
        const message = errorMessage(error);
        setNotice({ tone: "bad", text: message });
        if (message.toLowerCase().includes("team not found")) {
          storeTeamId(null);
          setBoard(null);
        }
      });
    }, 0);
    return () => {
      cancelled = true;
    };
  }, [configured, refreshBoard, teamId]);

  useEffect(() => {
    if (!teamId || !configured) return;
    const timer = window.setInterval(() => {
      refreshBoard(teamId).catch(() => undefined);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [configured, refreshBoard, teamId]);

  const challenges = useMemo(() => board?.challenges ?? [], [board]);
  const activeChallenge = useMemo(() => {
    return challenges.find((c) => c.slug === selectedSlug) ?? pickChallenge(board);
  }, [board, challenges, selectedSlug]);
  const activeActionResult =
    activeChallenge && actionResult?.slug === activeChallenge.slug ? actionResult.result : null;
  const solvedCount = challenges.filter((c) => c.solved).length;
  const progress = challenges.length ? Math.round((solvedCount / challenges.length) * 100) : 0;

  function selectChallenge(slug: string) {
    setSelectedSlug(slug);
    setActionResult(null);
    setFlagInput("");
  }

  async function createTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("team");
    setNotice(null);
    try {
      const created = await createLabyrinthTeam(teamName, handle);
      storeTeamId(created.team.id);
      setNotice({ tone: "ok", text: `Team ${created.team.name} joined ${created.event.title}.` });
      await refreshBoard(created.team.id);
    } catch (error) {
      setNotice({ tone: "bad", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function resetTeam() {
    storeTeamId(null);
    setBoard(null);
    setSelectedSlug(null);
    setInputs({});
    setActionResult(null);
    setFlagInput("");
    setNotice({ tone: "muted", text: "Local team session cleared." });
  }

  async function launchInstance() {
    if (!teamId || !activeChallenge) return;
    setBusy("instance");
    setNotice(null);
    try {
      const res = await launchLabyrinthInstance(teamId, activeChallenge.slug);
      setNotice({ tone: "ok", text: res.notes });
      await refreshBoard(teamId);
    } catch (error) {
      setNotice({ tone: "bad", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function runAction(action = "run") {
    if (!teamId || !activeChallenge) return;
    setBusy(action);
    setNotice(null);
    try {
      const payload = challengePayload(activeChallenge, inputs[activeChallenge.slug] ?? {});
      const res = await runLabyrinthAction(teamId, activeChallenge.slug, action, payload);
      setActionResult({ slug: activeChallenge.slug, result: res });
      const decoded = decodedFlagFromArtifacts(res.artifacts);
      if (res.flag) setFlagInput(res.flag);
      if (!res.flag && decoded) setFlagInput(decoded);
      setNotice({ tone: res.ok ? "ok" : "warn", text: res.message });
    } catch (error) {
      setNotice({ tone: "bad", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function submitFlag(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!teamId || !activeChallenge) return;
    setBusy("submit");
    setNotice(null);
    try {
      const res = await submitLabyrinthFlag(teamId, activeChallenge.slug, flagInput);
      setNotice({
        tone: res.correct ? "ok" : "bad",
        text: res.correct
          ? `${res.message}. ${res.pointsAwarded} points awarded.`
          : `${res.message}${res.leakedFrom ? ` Source team: ${res.leakedFrom}` : ""}.`,
      });
      await refreshBoard(teamId);
      if (res.nextUnlocked) setSelectedSlug(res.nextUnlocked);
      if (res.correct) {
        setActionResult(null);
        setFlagInput("");
      }
    } catch (error) {
      setNotice({ tone: "bad", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function unlockHint(order: number) {
    if (!teamId || !activeChallenge) return;
    setBusy(`hint-${order}`);
    setNotice(null);
    try {
      const res = await unlockLabyrinthHint(teamId, activeChallenge.slug, order);
      setNotice({
        tone: "ok",
        text: res.alreadyUnlocked
          ? "Hint already unlocked."
          : `Hint unlocked. Score is now ${res.team.score}.`,
      });
      await refreshBoard(teamId);
    } catch (error) {
      setNotice({ tone: "bad", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function downloadExport() {
    setBusy("export");
    setNotice(null);
    try {
      const exported = await exportLabyrinthState();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "labyrinth-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ tone: "ok", text: "Export generated." });
    } catch (error) {
      setNotice({ tone: "bad", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden dotgrid">
      <SiteHeader active="labyrinth" health={health} configured={configured} />

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 lg:overflow-hidden">
        {board ? (
          <>
            <CommandBar
              board={board}
              progress={progress}
              solvedCount={solvedCount}
              health={health}
              notice={notice}
              busy={busy}
              onRefresh={() => refreshBoard(board.team.id)}
              onReset={resetTeam}
            />
            <div className="grid shrink-0 gap-4 lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[318px_minmax(0,1fr)_360px] 2xl:grid-cols-[350px_minmax(0,1fr)_400px]">
              <StageRail
                challenges={challenges}
                activeSlug={activeChallenge?.slug ?? null}
                progress={progress}
                onSelect={selectChallenge}
              />

              <ChallengeWorkspace
                challenge={activeChallenge}
                values={activeChallenge ? (inputs[activeChallenge.slug] ?? {}) : {}}
                setValue={(name, value) => {
                  if (!activeChallenge) return;
                  setInputs((current) => ({
                    ...current,
                    [activeChallenge.slug]: {
                      ...(current[activeChallenge.slug] ?? {}),
                      [name]: value,
                    },
                  }));
                }}
                flagInput={flagInput}
                setFlagInput={setFlagInput}
                actionResult={activeActionResult}
                busy={busy}
                onLaunch={launchInstance}
                onRun={() => runAction("run")}
                onDump={() => runAction("dump")}
                onSubmit={submitFlag}
              />

              <RightRail
                board={board}
                activeChallenge={activeChallenge}
                busy={busy}
                onUnlock={unlockHint}
                onExport={downloadExport}
              />
            </div>
          </>
        ) : teamId ? (
          <ResumeSession teamId={teamId} notice={notice} />
        ) : (
          <JoinExperience
            configured={configured}
            event={event}
            notice={notice}
            busy={busy}
            teamName={teamName}
            handle={handle}
            setTeamName={setTeamName}
            setHandle={setHandle}
            onSubmit={createTeam}
          />
        )}
      </main>
    </div>
  );
}

function CommandBar({
  board,
  progress,
  solvedCount,
  health,
  notice,
  busy,
  onRefresh,
  onReset,
}: {
  board: BoardResponse;
  progress: number;
  solvedCount: number;
  health: Health | null;
  notice: Notice;
  busy: string | null;
  onRefresh: () => void;
  onReset: () => void;
}) {
  return (
    <section className="panel shrink-0 overflow-hidden">
      <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
        <span className="win-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="font-mono">
          <span className="prompt">~/labyrinth</span> $ ./ctfctl board --team {board.team.inviteCode}
        </span>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <StatusChip icon={Radio} tone="ok">
            {board.event.status}
          </StatusChip>
          <StatusChip icon={Server} tone={health ? "ok" : "warn"}>
            {health ? health.backend : "api?"}
          </StatusChip>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-terminal text-xs uppercase tracking-[0.16em]">
            <span className="prompt">{board.team.name}</span>
            <span className="text-muted">/ {board.team.handle}</span>
            <span className="chip border-border bg-surface-2/60 text-muted">{board.team.inviteCode}</span>
          </div>
          {notice ? (
            <NoticeBar notice={notice} />
          ) : (
            <div className="mt-2 h-7 min-w-0 truncate font-mono text-sm text-muted">
              <span className="prompt">$</span> {board.event.story}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-[96px_96px_96px_auto_auto]">
          <Metric label="score" value={board.team.score.toString()} />
          <Metric label="solves" value={`${solvedCount}/${board.event.maxStage}`} />
          <Metric label="progress" value={`${progress}%`} />
          <IconButton label="Refresh" icon={RefreshCw} onClick={onRefresh} busy={busy === "refresh"} />
          <IconButton label="Reset" icon={UserPlus} onClick={onReset} />
        </div>
      </div>
    </section>
  );
}

function ResumeSession({ teamId, notice }: { teamId: string; notice: Notice }) {
  return (
    <section className="panel mx-auto flex w-full max-w-3xl flex-col overflow-hidden">
      <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
        <span className="win-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="font-mono">hacker@tartarus: ~/labyrinth - resume</span>
      </div>
      <div className="p-6">
        <div className="prompt font-mono text-xs">
          hacker@tartarus:~/labyrinth$ <span className="text-muted">./ctfctl board --team {teamId}</span>
        </div>
        <GlitchText as="h1" className="mt-2 text-5xl leading-none tracking-tight sm:text-6xl">
          LABYRINTH
        </GlitchText>
        <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-muted">
          Restoring the current Tartarus UI session. Legacy Labyrinth sessions are ignored so stale
          pre-redesign state cannot replace this surface.
          <span className="prompt animate-blink"> _</span>
        </p>
        {notice && <NoticeBar notice={notice} />}
      </div>
    </section>
  );
}

function JoinExperience({
  configured,
  event,
  notice,
  busy,
  teamName,
  handle,
  setTeamName,
  setHandle,
  onSubmit,
}: {
  configured: boolean;
  event: EventResponse | null;
  notice: Notice;
  busy: string | null;
  teamName: string;
  handle: string;
  setTeamName: (value: string) => void;
  setHandle: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const challenges = event?.challenges ?? [];

  return (
    <div className="grid shrink-0 gap-4 lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
          <span className="win-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="font-mono">hacker@tartarus: ~/labyrinth - leoOS intrusion</span>
          <span className="chip ml-auto border-accent/40 bg-accent/5 text-accent">
            {event?.event.status ?? "offline"}
          </span>
        </div>

        <div className="min-h-0 flex-1 p-5">
          <div className="flex h-full min-h-0 flex-col">
            <div className="prompt font-mono text-xs">
              hacker@tartarus:~/labyrinth$ <span className="text-muted">./enter --event leoOS</span>
            </div>
            <GlitchText as="h1" className="mt-2 text-5xl leading-none tracking-tight sm:text-6xl">
              LABYRINTH
            </GlitchText>
            <p className="mt-2 font-terminal text-sm tracking-[0.2em] text-accent">
              {event?.event.title ?? "LeoOS Intrusion"}
            </p>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
              {event?.event.story ??
                "Connect the Tartarus gateway to enter the Labyrinth event."}
            </p>
            <div className="-mx-3 mt-2 min-h-0 flex-1 overflow-auto px-3 py-3">
              <div className="grid h-full auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
                {challenges.map((challenge) => (
                  <StagePreview key={challenge.slug} challenge={challenge} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border py-2">
          <Ticker items={LABYRINTH_FACTS} preserveCase />
        </div>
      </section>

      <section className="panel flex flex-col overflow-hidden">
        <div className="titlebar flex items-center gap-3 px-3 py-2 text-xs text-muted">
          <span className="win-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="font-mono">join-session</span>
        </div>
        <div className="flex flex-1 flex-col justify-start p-4 pt-6">
          <div className="mb-5">
            <div className="flex items-center gap-2 font-mono text-sm text-accent">
              <Terminal className="h-4 w-4" />
              <span className="prompt">$</span>
              <span>./join --event leoOS</span>
            </div>
            {notice && <NoticeBar notice={notice} />}
            {!configured && (
              <div className="mt-3 border border-amber/40 bg-amber/5 px-3 py-2 text-sm text-amber">
                Set `NEXT_PUBLIC_TARTARUS_API` to enable Labyrinth.
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="grid gap-3">
            <label className="block">
              <span className="mb-1 block font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">team</span>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={36}
                className="field h-11 w-full px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">handle</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={24}
                className="field h-11 w-full px-3 text-sm"
              />
            </label>
            <button disabled={!configured || busy === "team"} className="btn-accent h-11">
              <Rocket className="h-4 w-4" />
              {busy === "team" ? "joining..." : "enter labyrinth"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function StageRail({
  challenges,
  activeSlug,
  progress,
  onSelect,
}: {
  challenges: ChallengeView[];
  activeSlug: string | null;
  progress: number;
  onSelect: (slug: string) => void;
}) {
  return (
    <section className="panel flex min-h-[460px] flex-col overflow-hidden lg:min-h-0">
      <div className="titlebar px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-terminal text-xs uppercase tracking-[0.16em] text-muted">
            <Zap className="h-4 w-4" />
            ~/kill-chain
          </div>
          <span className="font-terminal text-xs text-accent">{progress}%</span>
        </div>
        <div className="progress mt-3">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="grid gap-2">
          {challenges.map((challenge) => (
            <StageButton
              key={challenge.slug}
              challenge={challenge}
              active={activeSlug === challenge.slug}
              onClick={() => onSelect(challenge.slug)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StageButton({
  challenge,
  active,
  onClick,
}: {
  challenge: ChallengeView;
  active: boolean;
  onClick: () => void;
}) {
  const status = challengeStatus(challenge);
  const Icon = status === "solved" ? CheckCircle2 : status === "open" ? UnlockKeyhole : Lock;
  const tone =
    status === "solved"
      ? "border-accent/45 bg-accent/10"
      : status === "open"
        ? "border-amber/45 bg-amber/5"
        : "border-border/60 bg-black/20 opacity-70";

  return (
    <button
      onClick={onClick}
      className={`panel-soft group grid min-h-24 grid-cols-[28px_minmax(0,1fr)] gap-3 p-3 text-left transition-colors ${tone} ${
        active ? "ring-1 ring-accent" : "hover:border-accent/40"
      }`}
    >
      <div className="screen flex h-7 w-7 items-center justify-center rounded-sm">
        <Icon className={status === "locked" ? "h-4 w-4 text-muted" : "h-4 w-4 text-accent"} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-terminal text-[11px] uppercase tracking-[0.16em]">
          <span className={active ? "prompt" : "text-muted"}>stage {challenge.stage}</span>
          <span className="ml-auto text-muted">{challenge.currentPoints}</span>
        </div>
        <div className="mt-1 truncate font-terminal text-sm text-foreground">{challenge.title}</div>
        <div className="mt-1 truncate text-xs text-muted">{challenge.stageLabel}</div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          <span>{challenge.category}</span>
          <span>{"*".repeat(challenge.difficulty)}</span>
          {challenge.firstBloodTeam && <Flame className="h-3 w-3 text-amber" />}
        </div>
      </div>
    </button>
  );
}

function ChallengeWorkspace({
  challenge,
  values,
  setValue,
  flagInput,
  setFlagInput,
  actionResult,
  busy,
  onLaunch,
  onRun,
  onDump,
  onSubmit,
}: {
  challenge: ChallengeView | null;
  values: Record<string, string>;
  setValue: (name: string, value: string) => void;
  flagInput: string;
  setFlagInput: (value: string) => void;
  actionResult: ChallengeActionResponse | null;
  busy: string | null;
  onLaunch: () => void;
  onRun: () => void;
  onDump: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  if (!challenge) {
    return (
      <section className="panel grid min-h-[460px] place-items-center p-6 text-center font-mono text-sm text-muted lg:min-h-0">
        <CircleDashed className="mb-3 h-8 w-8 text-muted" />
        <span><span className="prompt">$</span> select a stage</span>
      </section>
    );
  }

  if (!challenge.unlocked) {
    return (
      <section className="panel grid min-h-[460px] place-items-center p-6 text-center font-mono text-sm text-muted lg:min-h-0">
        <Lock className="mb-3 h-8 w-8 text-muted" />
        <span><span className="prompt">$</span> solve {challenge.unlockAfter} to unlock this stage</span>
      </section>
    );
  }

  return (
    <section className="panel flex min-h-[620px] flex-col overflow-hidden lg:min-h-0">
      <div className="titlebar flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="win-dots mr-1" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <StatusIcon status={challengeStatus(challenge)} />
        <div className="min-w-0">
          <div className="truncate font-terminal text-base text-foreground">
            <span className="prompt">~/labyrinth/stage-{challenge.stage}</span> $ {challenge.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <span>{challenge.stageLabel}</span>
            <span>{challenge.category}</span>
            <span>{challenge.currentPoints} pts</span>
            <span>{challenge.solveCount} solves</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onLaunch}
            disabled={busy === "instance"}
            className="btn-outline h-9 px-3 py-0 text-sm"
          >
            <Server className="h-4 w-4" />
            {busy === "instance" ? "Launching" : "Instance"}
          </button>
          {challenge.slug === "cold-boot" && (
            <button
              onClick={onDump}
              disabled={busy === "dump"}
              className="btn-ghost h-9 px-3 py-0 text-sm"
            >
              <Database className="h-4 w-4" />
              {busy === "dump" ? "Dumping" : "Dump VM"}
            </button>
          )}
          <button
            onClick={onRun}
            disabled={busy === "run"}
            className="btn-accent h-9 px-4 py-0 text-sm"
          >
            <Play className="h-4 w-4" />
            {busy === "run" ? "Running" : challenge.workbench?.actionLabel ?? "Run"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-h-0 overflow-auto p-4">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
            <section className="screen p-3">
              <div className="font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">brief.md</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{challenge.bodyMd}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {challenge.objectiveMd}
              </p>
              {challenge.instance && (
                <div className="mt-4 border border-accent/30 bg-accent/5 p-3 text-sm">
                  <div className="flex items-center gap-2 font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">
                    <Radio className="h-3.5 w-3.5" />
                    instance
                  </div>
                  <div className="mt-2 break-all text-accent">{challenge.instance.connInfo}</div>
                  <div className="mt-1 text-xs text-muted">
                    expires {timeLabel(challenge.instance.expiresAtUnix)}
                  </div>
                </div>
              )}
              {challenge.writeupMd && (
                <div className="mt-4 border border-accent/30 bg-accent/5 p-3 text-sm leading-relaxed">
                  <div className="mb-2 flex items-center gap-2 font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">
                    <FileJson className="h-3.5 w-3.5" />
                    writeup
                  </div>
                  {challenge.writeupMd}
                </div>
              )}
            </section>

            <WorkbenchFields challenge={challenge} values={values} setValue={setValue} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col border-t border-border bg-black/20 lg:border-l lg:border-t-0">
          <ArtifactsPanel result={actionResult} onUse={(value) => setFlagInput(value)} />
          <FlagSubmitPanel
            value={flagInput}
            setValue={setFlagInput}
            busy={busy}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </section>
  );
}

function WorkbenchFields({
  challenge,
  values,
  setValue,
}: {
  challenge: ChallengeView;
  values: Record<string, string>;
  setValue: (name: string, value: string) => void;
}) {
  if (!challenge.workbench) {
    return <div className="text-sm text-muted">No workbench for this stage.</div>;
  }

  return (
    <section className="grid content-start gap-3">
      <div className="flex items-center gap-2 font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">
        <Terminal className="h-3.5 w-3.5" />
        workbench.env
      </div>
      {challenge.workbench.fields.map((field) => (
        <label key={field.name} className="block">
          <span className="mb-1 block font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">{field.label}</span>
          {field.kind === "textarea" ? (
            <textarea
              value={values[field.name] ?? field.defaultValue}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              spellCheck={false}
              className="field min-h-32 w-full resize-y px-3 py-2 font-mono text-sm leading-relaxed placeholder:text-muted"
            />
          ) : (
            <input
              value={values[field.name] ?? field.defaultValue}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              inputMode={field.kind === "number" ? "numeric" : "text"}
              className="field h-10 w-full px-3 font-mono text-sm placeholder:text-muted"
            />
          )}
        </label>
      ))}
    </section>
  );
}

function ArtifactsPanel({
  result,
  onUse,
}: {
  result: ChallengeActionResponse | null;
  onUse: (value: string) => void;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden">
      <div className="titlebar flex items-center gap-2 px-3 py-2 text-xs text-muted">
        <Terminal className="h-3.5 w-3.5" />
        artifacts/
      </div>
      <div className="h-full overflow-auto p-3 pb-12">
        {result ? (
          <div className="grid gap-2">
            <div className={`font-mono text-sm ${result.ok ? "text-accent" : "text-amber"}`}>
              <span className="prompt">$</span> {result.message}
            </div>
            {result.artifacts.map((artifact) => (
              <ArtifactRow
                key={`${artifact.label}-${artifact.kind}`}
                artifact={artifact}
                onUse={onUse}
              />
            ))}
          </div>
        ) : (
          <div className="screen grid h-40 place-items-center border-dashed text-center font-mono text-sm text-muted">
            <span><span className="prompt">$</span> run workbench to capture artifacts</span>
          </div>
        )}
      </div>
    </section>
  );
}

function ArtifactRow({ artifact, onUse }: { artifact: ActionArtifact; onUse: (value: string) => void }) {
  const decoded = artifact.kind === "encoded-flag" ? rot13(artifact.value) : null;
  const usable = artifact.kind === "flag" || artifact.kind === "encoded-flag";
  return (
    <div className="screen p-2">
      <div className="flex items-center gap-2">
        <span className="truncate font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">{artifact.label}</span>
        {usable && (
          <button
            onClick={() => onUse(decoded ?? artifact.value)}
            className="btn-ghost ml-auto h-7 px-2 py-0 text-xs"
            type="button"
          >
            <Flag className="h-3.5 w-3.5" />
            use
          </button>
        )}
      </div>
      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
        {artifact.value}
      </pre>
      {decoded && <div className="mt-2 break-all font-mono text-xs text-accent">decoded: {decoded}</div>}
    </div>
  );
}

function FlagSubmitPanel({
  value,
  setValue,
  busy,
  onSubmit,
}: {
  value: string;
  setValue: (value: string) => void;
  busy: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-border p-3">
      <div className="mb-2 flex items-center gap-2 font-terminal text-[11px] uppercase tracking-[0.18em] text-muted">
        <KeyRound className="h-3.5 w-3.5" />
        submit flag
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px] lg:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_112px]">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="flag{...}"
          spellCheck={false}
          className="field h-10 min-w-0 px-3 font-mono text-sm placeholder:text-muted"
        />
        <button
          disabled={busy === "submit" || !value.trim()}
          className="btn-accent h-10 px-3 py-0 text-sm"
        >
          <Send className="h-4 w-4" />
          {busy === "submit" ? "Sending" : "Submit"}
        </button>
      </div>
    </form>
  );
}

function RightRail({
  board,
  activeChallenge,
  busy,
  onUnlock,
  onExport,
}: {
  board: BoardResponse;
  activeChallenge: ChallengeView | null;
  busy: string | null;
  onUnlock: (order: number) => void;
  onExport: () => void;
}) {
  return (
    <aside className="grid gap-3 lg:col-span-2 xl:col-span-1 xl:flex xl:min-h-0 xl:flex-col">
      {activeChallenge && <HintsPanel challenge={activeChallenge} busy={busy} onUnlock={onUnlock} />}
      <Scoreboard rows={board.scoreboard} currentTeamId={board.team.id} />
      <OpsPanel busy={busy} onExport={onExport} recent={board.recentSolves} />
    </aside>
  );
}

function HintsPanel({
  challenge,
  busy,
  onUnlock,
}: {
  challenge: ChallengeView;
  busy: string | null;
  onUnlock: (order: number) => void;
}) {
  return (
    <section className="panel min-h-0 overflow-hidden xl:flex-[0_1_32%]">
      <div className="titlebar flex items-center gap-2 px-3 py-2 font-terminal text-xs uppercase tracking-[0.16em] text-muted">
        <AlertTriangle className="h-3.5 w-3.5" />
        hints
      </div>
      <div className="max-h-64 overflow-auto p-3 xl:max-h-none">
        <div className="grid gap-2">
          {challenge.hints.map((hint) => (
            <div key={hint.order} className="panel-soft p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-terminal text-xs uppercase tracking-[0.16em] text-muted">hint {hint.order}</span>
                <span className="ml-auto font-mono text-xs text-muted">{hint.cost} pts</span>
              </div>
              {hint.unlocked ? (
                <p className="mt-2 leading-relaxed text-foreground">{hint.bodyMd}</p>
              ) : (
                <button
                  onClick={() => onUnlock(hint.order)}
                  disabled={busy === `hint-${hint.order}` || !challenge.unlocked}
                  className="btn-outline mt-2 h-8 px-2 py-0 text-xs"
                >
                  <UnlockKeyhole className="h-3.5 w-3.5" />
                  {busy === `hint-${hint.order}` ? "Unlocking" : "Unlock"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Scoreboard({
  rows,
  currentTeamId,
}: {
  rows: ScoreboardEntry[];
  currentTeamId: string | null;
}) {
  return (
    <section className="panel min-h-0 overflow-hidden xl:flex-[1_1_34%]">
      <div className="titlebar flex items-center gap-2 px-3 py-2 font-terminal text-xs uppercase tracking-[0.16em] text-muted">
        <Trophy className="h-3.5 w-3.5" />
        scoreboard
      </div>
      {rows.length ? (
        <div className="max-h-72 overflow-auto xl:max-h-none">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2/80 text-left font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">team</th>
                <th className="px-3 py-2 text-right">score</th>
                <th className="px-3 py-2 text-right">solves</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.teamId}
                  className={`border-t border-border/40 ${row.teamId === currentTeamId ? "bg-accent/5 text-accent" : ""}`}
                >
                  <td className="px-3 py-2 text-muted">{index + 1}</td>
                  <td className="min-w-0 px-3 py-2">
                    <div className="truncate font-mono text-foreground">{row.teamName}</div>
                    <div className="truncate text-xs text-muted">@{row.handle}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{row.score}</td>
                  <td className="px-3 py-2 text-right text-muted">{row.solvedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-3 text-sm text-muted">No teams yet.</div>
      )}
    </section>
  );
}

function OpsPanel({
  busy,
  onExport,
  recent,
}: {
  busy: string | null;
  onExport: () => void;
  recent: SolveView[];
}) {
  return (
    <section className="panel min-h-0 overflow-hidden xl:flex-[1_1_34%]">
      <div className="titlebar flex items-center gap-2 px-3 py-2 font-terminal text-xs uppercase tracking-[0.16em] text-muted">
        <Activity className="h-3.5 w-3.5" />
        activity
        <button
          onClick={onExport}
          className="btn-ghost ml-auto h-7 px-2 py-0 text-xs"
          disabled={busy === "export"}
        >
          <Download className="h-3.5 w-3.5" />
          {busy === "export" ? "exporting" : "export"}
        </button>
      </div>
      <div className="max-h-72 overflow-auto p-3 xl:max-h-none">
        <div className="grid gap-2 text-sm">
          {recent.length ? (
            recent.map((solve) => (
              <div
                key={`${solve.teamId}-${solve.challengeSlug}-${solve.solvedAtUnix}`}
                className="panel-soft p-2"
              >
                <div className="flex items-center gap-2 text-foreground">
                  {solve.firstBlood && <Flame className="h-3.5 w-3.5 text-amber" />}
                  <span className="truncate">{solve.teamName}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {solve.challengeTitle} / {solve.pointsAwarded} pts
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted">No solves yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function StagePreview({ challenge }: { challenge: PublicChallenge }) {
  const stageCode = String(challenge.stage).padStart(2, "0");
  const description =
    challenge.description ??
    PUBLIC_CHALLENGE_DESCRIPTIONS[challenge.slug] ??
    `${challenge.stageLabel} challenge in the ${challenge.category} track.`;
  const [flipped, setFlipped] = useState(false);
  const faceClass =
    "absolute inset-0 flex flex-col justify-between overflow-hidden rounded-md border border-accent/25 bg-[linear-gradient(145deg,rgba(6,14,13,0.96),rgba(9,20,18,0.82)_52%,rgba(16,44,34,0.58))] p-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.42),0_0_0_1px_rgba(70,247,164,0.08),inset_0_1px_0_rgba(166,255,216,0.12),inset_0_-18px_34px_rgba(0,0,0,0.28)] [backface-visibility:hidden] group-hover:border-accent/45 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.46),0_0_0_1px_rgba(70,247,164,0.18),inset_0_1px_0_rgba(166,255,216,0.16),inset_0_0_28px_rgba(70,247,164,0.08),inset_0_-18px_34px_rgba(0,0,0,0.26)]";

  return (
    <button
      type="button"
      data-stage-card
      aria-pressed={flipped}
      aria-label={`${challenge.title} challenge description`}
      onClick={() => setFlipped((value) => !value)}
      className="group relative h-full min-h-[176px] w-full text-left [perspective:1200px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div
        className={`relative h-full min-h-[176px] transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className={faceClass} aria-hidden={flipped}>
          <StageCardChrome stageCode={stageCode} />
          <div className="relative z-10 flex items-center gap-3 font-terminal text-[13px] uppercase tracking-[0.18em] text-muted">
            <span className="text-accent/90">stage {stageCode}</span>
            <span className="ml-auto rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[12px] tracking-normal text-accent shadow-[0_0_18px_rgba(70,247,164,0.12)]">
              {challenge.currentPoints} pts
            </span>
          </div>
          <div className="relative z-10 mt-3 break-words font-terminal text-[23px] leading-tight text-foreground glow sm:text-[25px] xl:text-[24px] 2xl:text-[26px]">
            {challenge.title}
          </div>
          <div className="relative z-10 mt-2 font-mono text-base leading-snug text-muted sm:text-[17px]">
            {challenge.stageLabel}
          </div>
        </div>
        <div className={`${faceClass} [transform:rotateY(180deg)]`} aria-hidden={!flipped}>
          <StageCardChrome stageCode={stageCode} />
          <div className="relative z-10 flex items-center gap-3 font-terminal text-[13px] uppercase tracking-[0.18em] text-muted">
            <span className="text-accent/90">brief</span>
            <span className="ml-auto rounded-sm border border-accent/25 bg-black/20 px-1.5 py-0.5 font-mono text-[12px] tracking-normal text-accent">
              {challenge.category}
            </span>
          </div>
          <p className="relative z-10 mt-3 font-mono text-[15px] leading-snug text-foreground sm:text-base">
            {description}
          </p>
          <div className="relative z-10 mt-2 font-terminal text-[11px] uppercase tracking-[0.16em] text-muted">
            stage {stageCode} / {challenge.currentPoints} pts
          </div>
        </div>
      </div>
    </button>
  );
}

function StageCardChrome({ stageCode }: { stageCode: string }) {
  return (
    <>
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-accent/65 to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -right-5 -top-6 font-terminal text-[86px] leading-none text-accent/[0.045]"
        aria-hidden
      >
        {stageCode}
      </span>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-md border border-border bg-surface/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(70,247,164,0.08)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent/70 via-cyan/30 to-transparent" />
      <div className="flex items-center gap-2 font-terminal text-[10px] uppercase text-faint">
        <span className="truncate">{label}</span>
        <span className="ml-auto text-accent/80">ready</span>
      </div>
      <div className="mt-2 truncate font-terminal text-[22px] leading-none text-accent glow">
        {value}
      </div>
      {detail && <div className="mt-1 truncate font-mono text-[11px] text-muted">{detail}</div>}
    </div>
  );
}

function StatusChip({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: "ok" | "warn" | "bad" | "muted";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-accent/40 bg-accent/5 text-accent"
      : tone === "warn"
        ? "border-amber/40 bg-amber/5 text-amber"
        : tone === "bad"
          ? "border-red/40 bg-red/5 text-red"
          : "border-border bg-surface-2/60 text-muted";
  return (
    <span className={`chip ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  busy,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      className="btn-outline h-full min-h-12 px-3 text-sm"
      title={label}
    >
      <Icon className="h-4 w-4 text-accent" />
      <span className="hidden sm:inline">{busy ? "Working" : label}</span>
    </button>
  );
}

function NoticeBar({ notice }: { notice: NonNullable<Notice> }) {
  const Icon = notice.tone === "bad" || notice.tone === "warn" ? AlertTriangle : CheckCircle2;
  const cls =
    notice.tone === "ok"
      ? "border-accent/40 bg-accent/5 text-accent"
      : notice.tone === "warn"
        ? "border-amber/40 bg-amber/5 text-amber"
        : notice.tone === "bad"
          ? "border-red/40 bg-red/5 text-red"
          : "border-border bg-black/20 text-muted";
  return (
    <div className={`mt-2 flex min-h-8 items-center gap-2 border px-3 font-mono text-sm ${cls}`}>
      <Icon className="h-4 w-4" />
      <span className="min-w-0 truncate">{notice.text}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: ChallengeStatus }) {
  const Icon = status === "solved" ? CheckCircle2 : status === "open" ? UnlockKeyhole : Lock;
  return (
    <div className="screen flex h-9 w-9 shrink-0 items-center justify-center">
      <Icon className={status === "locked" ? "h-4 w-4 text-muted" : "h-4 w-4 text-accent"} />
    </div>
  );
}

function challengeStatus(challenge: ChallengeView): ChallengeStatus {
  if (challenge.solved) return "solved";
  if (challenge.unlocked) return "open";
  return "locked";
}

function pickChallenge(board: BoardResponse | null): ChallengeView | null {
  if (!board) return null;
  return (
    board.challenges.find((c) => c.unlocked && !c.solved) ??
    board.challenges.find((c) => c.unlocked) ??
    board.challenges[0] ??
    null
  );
}

function challengePayload(challenge: ChallengeView, values: Record<string, string>): Record<string, string> {
  if (!challenge.workbench) return values;
  return Object.fromEntries(
    challenge.workbench.fields.map((field) => [field.name, values[field.name] ?? field.defaultValue])
  );
}

function decodedFlagFromArtifacts(artifacts: ActionArtifact[]): string | null {
  const encoded = artifacts.find((artifact) => artifact.kind === "encoded-flag");
  return encoded ? rot13(encoded.value) : null;
}

function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function timeLabel(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useStoredTeamId(): string | null {
  return useSyncExternalStore(subscribeTeamId, readTeamId, () => null);
}

function subscribeTeamId(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("labyrinth-team", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("labyrinth-team", onStoreChange);
  };
}

function readTeamId(): string | null {
  return window.localStorage.getItem(TEAM_KEY);
}

function storeTeamId(value: string | null) {
  clearLegacyTeamIds();
  if (value) {
    window.localStorage.setItem(TEAM_KEY, value);
  } else {
    window.localStorage.removeItem(TEAM_KEY);
  }
  window.dispatchEvent(new Event("labyrinth-team"));
}

function clearLegacyTeamIds() {
  for (const key of LEGACY_TEAM_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
