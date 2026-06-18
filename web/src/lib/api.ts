// Thin client for the Tartarus gateway. The base URL comes from NEXT_PUBLIC_TARTARUS_API; when it's
// unset the UI shows a "backend not connected" state and never fabricates results.

import type { Health, LeaderboardSummary, RunRequest, RunResult } from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_TARTARUS_API ?? "").replace(/\/+$/, "");

export function apiConfigured(): boolean {
  return API_BASE.length > 0;
}

export async function getHealth(): Promise<Health | null> {
  if (!apiConfigured()) return null;
  try {
    const res = await fetch(`${API_BASE}/healthz`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardSummary | null> {
  if (!apiConfigured()) return null;
  try {
    const res = await fetch(`${API_BASE}/arena/leaderboard`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as LeaderboardSummary;
  } catch {
    return null;
  }
}

interface PollResponse {
  status: "pending" | "done" | "error" | "timeout";
  result?: RunResult;
}

/** Submit a job, then poll until it completes. Throws on transport/timeout errors. */
export async function runAndWait(
  req: RunRequest,
  opts: { onStatus?: (s: string) => void; timeoutMs?: number } = {}
): Promise<RunResult> {
  if (!apiConfigured()) throw new Error("Backend not configured");
  const { onStatus, timeoutMs = 30_000 } = opts;

  onStatus?.("queued");
  const submit = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!submit.ok) {
    const body = await submit.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `submit failed (${submit.status})`);
  }
  const { id } = (await submit.json()) as { id: string };

  const deadline = Date.now() + timeoutMs;
  onStatus?.("running");
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/run/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as PollResponse;
      if (data.status === "done" && data.result) return data.result;
      if (data.status === "error") throw new Error("run failed on the server");
    }
    await sleep(180);
  }
  throw new Error("timed out waiting for result");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
