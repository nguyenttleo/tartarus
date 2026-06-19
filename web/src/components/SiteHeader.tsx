"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Health } from "@/lib/types";

type Section = "ide" | "arena" | "labyrinth";

const CWD: Record<Section, string> = {
  ide: "~",
  arena: "~/arena",
  labyrinth: "~/labyrinth",
};

const NAV: { href: string; id: Section; label: string }[] = [
  { href: "/", id: "ide", label: "ide" },
  { href: "/arena", id: "arena", label: "arena" },
  { href: "/labyrinth", id: "labyrinth", label: "labyrinth" },
];

export function SiteHeader({
  active,
  health,
  configured,
}: {
  active: Section;
  health: Health | null;
  configured: boolean;
}) {
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    // z-[80] keeps the bar above the CRT (z-60) and the `.screen` surfaces (z-61).
    <header className="titlebar sticky top-0 z-[80] border-b border-border">
      <div className="mx-auto flex h-10 max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-1 px-4 text-sm">
        <Link href="/" className="flex items-center gap-2 font-terminal" aria-label="Tartarus home">
          <span className="h-2.5 w-2.5 rounded-full bg-accent glow animate-blink" aria-hidden />
          <span className="text-muted">
            <span className="text-foreground">hacker</span>@<span className="prompt">tartarus</span>
            <span className="hidden sm:inline">:{CWD[active]}</span>
            <span className="prompt">$</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 font-terminal text-[0.95rem]">
          {NAV.map((s) => {
            const on = active === s.id;
            return (
              <Link
                key={s.id}
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`px-2 py-1 transition-colors ${
                  on ? "prompt glow" : "text-muted hover:text-accent"
                }`}
              >
                {on ? `[${s.label}]` : s.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 font-terminal">
          <span className="hidden tabular-nums text-muted sm:inline">{clock}</span>
          <StatusPill health={health} configured={configured} />
        </div>
      </div>
    </header>
  );
}

function StatusPill({ health, configured }: { health: Health | null; configured: boolean }) {
  if (!configured) return <Tag tone="amber">no backend</Tag>;
  if (!health) return <Tag tone="red">offline</Tag>;
  return <Tag tone="green">online · {health.backend}</Tag>;
}

function Tag({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "green"
      ? "text-accent border-accent/40 bg-accent/5"
      : tone === "amber"
        ? "text-amber border-amber/40 bg-amber/5"
        : "text-red border-red/40 bg-red/5";
  return <span className={`chip chip-dot ${cls}`}>{children}</span>;
}
