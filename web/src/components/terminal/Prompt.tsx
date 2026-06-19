// The shell prompt label, reused everywhere a "real terminal line" is shown:
//   hacker@tartarus:~$
// Always left-aligned by the caller; the `$` is part of the prompt on the left.
export function Prompt({ cwd = "~", className = "" }: { cwd?: string; className?: string }) {
  return (
    <span className={`select-none whitespace-nowrap ${className}`}>
      <span className="text-foreground">hacker</span>
      <span className="text-muted">@</span>
      <span className="prompt">tartarus</span>
      <span className="text-muted">
        :{cwd}$
      </span>
    </span>
  );
}
