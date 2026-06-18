"use client";

import Link from "next/link";
import type { Health } from "@/lib/types";

export function SiteHeader({
  active,
  health,
  configured,
}: {
  active: "ide" | "arena";
  health: Health | null;
  configured: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-widest text-accent glow">TARTARUS</span>
          <span className="hidden text-xs text-muted sm:inline">secure code execution sandbox</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" label="IDE" active={active === "ide"} />
          <NavLink href="/arena" label="Escape Arena" active={active === "arena"} />
        </nav>

        <div className="ml-auto">
          <StatusPill health={health} configured={configured} />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-2.5 py-1 transition-colors ${
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function StatusPill({ health, configured }: { health: Health | null; configured: boolean }) {
  if (!configured) {
    return <Tag tone="amber">no backend configured</Tag>;
  }
  if (!health) {
    return <Tag tone="red">● backend offline</Tag>;
  }
  return <Tag tone="green">● backend online · {health.backend}</Tag>;
}

function Tag({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "green"
      ? "text-accent border-accent/40"
      : tone === "amber"
        ? "text-amber border-amber/40"
        : "text-red border-red/40";
  return <span className={`rounded-full border px-2.5 py-1 text-xs ${cls}`}>{children}</span>;
}
