// A scrolling status ticker - the sandbox's guarantees on an endless loop.
// The track is duplicated so the marquee wraps seamlessly; hover to pause.
export function Ticker({
  items,
  className = "",
  preserveCase = false,
}: {
  items: string[];
  className?: string;
  preserveCase?: boolean;
}) {
  const sep = (
    <span className="px-3 text-accent/40" aria-hidden>
      ◢◤
    </span>
  );
  const run = (key: string) => (
    <span className="marquee__track" key={key}>
      {items.map((item, i) => (
        <span key={i} className="text-muted">
          <span className="text-accent/80">▸</span> {item}
          {sep}
        </span>
      ))}
    </span>
  );
  return (
    <div
      className={`marquee font-terminal text-xs ${preserveCase ? "" : "uppercase"} tracking-wider ${className}`}
      aria-hidden
    >
      {run("a")}
      {run("b")}
    </div>
  );
}
