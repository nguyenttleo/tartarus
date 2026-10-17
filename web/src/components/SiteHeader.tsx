"use client";

import Link from "next/link";
import { BackendStatus } from "@/components/BackendStatus";
import type { Health } from "@/lib/types";
import type { HealthSample } from "@/lib/useHealth";

type Section = "ide" | "arena";

const NAV: { href: string; id: Section; label: string }[] = [
  { href: "/", id: "ide", label: "ide" },
  { href: "/arena", id: "arena", label: "arena" },
];

export function SiteHeader({
  active,
  health,
  configured,
  samples,
  onRefresh,
}: {
  active: Section;
  health: Health | null | undefined;
  configured: boolean;
  samples: HealthSample[];
  onRefresh: () => void;
}) {
  return (
    <header className="sticky top-0 z-[80] bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1200px] items-center gap-6 px-4 text-sm">
        <Link href="/" className="font-display text-2xl leading-none text-accent" aria-label="Tartarus home">
          tartarus
        </Link>

        <nav className="flex items-center gap-1 text-sm text-muted">
          {NAV.map((s) => {
            const on = active === s.id;
            return (
              <Link
                key={s.id}
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`site-nav-link ${on ? "site-nav-link-active" : ""}`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>

        <BackendStatus health={health} configured={configured} samples={samples} onRefresh={onRefresh} />
      </div>
    </header>
  );
}
