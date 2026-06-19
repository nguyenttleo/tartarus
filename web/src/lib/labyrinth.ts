import { API_BASE, apiConfigured } from "./api";

export interface LabyrinthEvent {
  id: string;
  title: string;
  status: string;
  story: string;
  maxStage: number;
  flagFormat: string;
  scoring: string;
}

export interface PublicChallenge {
  slug: string;
  title: string;
  description?: string;
  category: string;
  stage: number;
  stageLabel: string;
  difficulty: number;
  basePoints: number;
  floorPoints: number;
  unlockAfter: string | null;
  solveCount: number;
  currentPoints: number;
}

export interface LabyrinthTeam {
  id: string;
  name: string;
  handle: string;
  inviteCode: string;
  score: number;
  createdAtUnix: number;
  banned: boolean;
}

export interface LabyrinthInstance {
  id: string;
  challengeSlug: string;
  teamId: string;
  status: string;
  connInfo: string;
  createdAtUnix: number;
  expiresAtUnix: number;
}

export interface WorkbenchField {
  name: string;
  label: string;
  kind: "text" | "textarea" | "number" | string;
  placeholder: string;
  defaultValue: string;
}

export interface WorkbenchDef {
  actionLabel: string;
  fields: WorkbenchField[];
}

export interface HintView {
  order: number;
  cost: number;
  unlocked: boolean;
  bodyMd: string | null;
}

export interface ChallengeView extends PublicChallenge {
  firstBloodTeam: string | null;
  unlocked: boolean;
  solved: boolean;
  bodyMd: string | null;
  objectiveMd: string | null;
  workbench: WorkbenchDef | null;
  hints: HintView[];
  writeupMd: string | null;
  instance: LabyrinthInstance | null;
}

export interface ScoreboardEntry {
  teamId: string;
  teamName: string;
  handle: string;
  score: number;
  solvedCount: number;
  firstBloods: number;
  lastSolveUnix: number;
}

export interface SolveView {
  teamId: string;
  teamName: string;
  challengeSlug: string;
  challengeTitle: string;
  pointsAwarded: number;
  firstBlood: boolean;
  solvedAtUnix: number;
}

export interface EventResponse {
  event: LabyrinthEvent;
  challenges: PublicChallenge[];
  scoreboard: ScoreboardEntry[];
}

export interface TeamEnvelope {
  event: LabyrinthEvent;
  team: LabyrinthTeam;
}

export interface BoardResponse {
  event: LabyrinthEvent;
  team: LabyrinthTeam;
  challenges: ChallengeView[];
  recentSolves: SolveView[];
  scoreboard: ScoreboardEntry[];
}

export interface ScoreboardResponse {
  event: LabyrinthEvent;
  scoreboard: ScoreboardEntry[];
  recentSolves: SolveView[];
}

export interface ActionArtifact {
  label: string;
  value: string;
  kind: string;
}

export interface ChallengeActionResponse {
  ok: boolean;
  message: string;
  artifacts: ActionArtifact[];
  flag: string | null;
}

export interface FlagSubmissionResponse {
  correct: boolean;
  alreadySolved: boolean;
  pointsAwarded: number;
  firstBlood: boolean;
  verdict: string;
  message: string;
  leakedFrom: string | null;
  nextUnlocked: string | null;
  team: LabyrinthTeam;
  scoreboard: ScoreboardEntry[];
}

export interface HintUnlockResponse {
  team: LabyrinthTeam;
  hint: HintView;
  alreadyUnlocked: boolean;
  scoreboard: ScoreboardEntry[];
}

export interface InstanceResponse {
  instance: LabyrinthInstance;
  notes: string;
}

export interface AdminExport {
  event: LabyrinthEvent;
  teams: LabyrinthTeam[];
  solves: unknown[];
  submissions: unknown[];
  instances: LabyrinthInstance[];
  scoreboard: ScoreboardEntry[];
}

export async function getLabyrinthEvent(): Promise<EventResponse | null> {
  if (!apiConfigured()) return null;
  try {
    return await labyrinthRequest<EventResponse>("/event");
  } catch {
    return null;
  }
}

export async function getLabyrinthBoard(teamId: string): Promise<BoardResponse> {
  return labyrinthRequest<BoardResponse>(`/teams/${encodeURIComponent(teamId)}/board`, {
    cache: "no-store",
  });
}

export async function getLabyrinthScoreboard(): Promise<ScoreboardResponse | null> {
  if (!apiConfigured()) return null;
  try {
    return await labyrinthRequest<ScoreboardResponse>("/scoreboard", { cache: "no-store" });
  } catch {
    return null;
  }
}

export async function createLabyrinthTeam(teamName: string, handle: string): Promise<TeamEnvelope> {
  return labyrinthRequest<TeamEnvelope>("/teams", {
    method: "POST",
    body: JSON.stringify({ teamName, handle }),
  });
}

export async function submitLabyrinthFlag(
  teamId: string,
  challengeSlug: string,
  value: string
): Promise<FlagSubmissionResponse> {
  return labyrinthRequest<FlagSubmissionResponse>(`/teams/${encodeURIComponent(teamId)}/submissions`, {
    method: "POST",
    body: JSON.stringify({
      challengeSlug,
      value,
      fingerprint: browserFingerprint(),
    }),
  });
}

export async function runLabyrinthAction(
  teamId: string,
  challengeSlug: string,
  action: string,
  payload: Record<string, string>
): Promise<ChallengeActionResponse> {
  return labyrinthRequest<ChallengeActionResponse>(
    `/teams/${encodeURIComponent(teamId)}/challenges/${encodeURIComponent(challengeSlug)}/actions`,
    {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    }
  );
}

export async function launchLabyrinthInstance(
  teamId: string,
  challengeSlug: string
): Promise<InstanceResponse> {
  return labyrinthRequest<InstanceResponse>(
    `/teams/${encodeURIComponent(teamId)}/challenges/${encodeURIComponent(challengeSlug)}/instance`,
    { method: "POST" }
  );
}

export async function unlockLabyrinthHint(
  teamId: string,
  challengeSlug: string,
  order: number
): Promise<HintUnlockResponse> {
  return labyrinthRequest<HintUnlockResponse>(
    `/teams/${encodeURIComponent(teamId)}/challenges/${encodeURIComponent(challengeSlug)}/hints/${order}`,
    { method: "POST" }
  );
}

export async function exportLabyrinthState(): Promise<AdminExport> {
  return labyrinthRequest<AdminExport>("/export", { cache: "no-store" });
}

async function labyrinthRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiConfigured()) throw new Error("Labyrinth backend is not configured");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${API_BASE}/labyrinth${path}`, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Labyrinth request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function browserFingerprint(): string {
  if (typeof navigator === "undefined") return "server";
  return `${navigator.platform}:${navigator.language}:${screen.width}x${screen.height}`;
}
