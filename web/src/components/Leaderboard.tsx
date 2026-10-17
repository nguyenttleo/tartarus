import type { LeaderboardSummary } from "@/lib/types";

function ago(unix: number, now: number) {
  const s = Math.max(0, Math.round(now / 1000 - unix));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Leaderboard({ board, now }: { board: LeaderboardSummary | null; now: number }) {
  return (
    <section aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title" className="editorial-title text-[2.75rem] text-foreground">
        Leaderboard
      </h2>
      {board && board.techniques.length > 0 ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="ui-label border-b border-border-strong text-left">
              <th className="py-2 pr-4 font-normal">technique</th>
              <th className="py-2 pr-4 text-right font-normal">attempts</th>
              <th className="py-2 pr-4 text-right font-normal">escapes</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">last seen</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {board.techniques.map((t) => (
              <tr key={t.technique} className="border-b border-border transition-colors hover:bg-surface/60">
                <td className="py-2.5 pr-4 text-foreground">{t.technique}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-muted">{t.attempts}</td>
                <td
                  className={`py-2.5 pr-4 text-right tabular-nums ${t.escapes > 0 ? "text-red" : "text-verdigris"}`}
                >
                  {t.escapes}
                </td>
                <td className="hidden py-2.5 text-right tabular-nums text-faint sm:table-cell">
                  {ago(t.lastSeenUnix, now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 border-y border-border py-5 text-sm text-muted">
          {board ? "No attempts yet. Yours would be the first." : "Attempts show up here once the API is connected."}
        </p>
      )}
    </section>
  );
}
