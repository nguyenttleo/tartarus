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
    <header className="sticky top-0 z-[80] border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-8 px-6">
        <Link href="/" className="wordmark" aria-label="Tartarus home">
          TARTARUS
        </Link>

        <nav className="flex items-center gap-5 text-xs">
          {NAV.map((s) => (
            <Link key={s.id} href={s.href} aria-current={active === s.id ? "page" : undefined} className="nav-link">
              {s.label}
            </Link>
          ))}
        </nav>

        <BackendStatus health={health} configured={configured} samples={samples} onRefresh={onRefresh} />
      </div>
    </header>
  );
}
