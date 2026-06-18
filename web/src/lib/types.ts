// Mirror of the Tartarus run contract (crates/tartarus-core/src/types.rs). Field names are camelCase
// to match the server's serde output.

export type Language = "python" | "javascript";

export type RunMode = "normal" | "arena";

export interface Limits {
  wallMs: number;
  fuel: number;
  memoryBytes: number;
  outputBytes: number;
}

export type Outcome =
  | "completed"
  | "timed_out"
  | "out_of_memory"
  | "cpu_exhausted"
  | "trapped"
  | "startup_error";

export interface TraceEvent {
  seq: number;
  tMs: number;
  kind: string;
  detail: string;
  denied: boolean;
}

export interface EscapeOutcome {
  technique: string;
  succeeded: boolean;
  notes: string;
}

export interface RunResult {
  id: string;
  backend: string;
  lang: Language;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  oom: boolean;
  outputTruncated: boolean;
  outcome: Outcome;
  fuelUsed: number | null;
  trace: TraceEvent[];
  escape?: EscapeOutcome | null;
}

export interface LangInfo {
  id: Language;
  label: string;
  available: boolean;
}

export interface Health {
  status: string;
  backend: string;
  uptimeSeconds: number;
  languages: LangInfo[];
  maxLimits: Limits;
}

export interface LeaderboardEntry {
  technique: string;
  attempts: number;
  escapes: number;
  lastSeenUnix: number;
}

export interface LeaderboardSummary {
  totalAttempts: number;
  totalEscapes: number;
  techniques: LeaderboardEntry[];
}

export interface RunRequest {
  lang: Language;
  source: string;
  stdin?: string;
  limits?: Limits;
  mode?: RunMode;
  technique?: string;
}
