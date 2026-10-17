import { useEffect, useRef, useState } from "react";
import { apiConfigured, getHealth } from "./api";
import type { Health } from "./types";

export type HealthSample = { at: number; ms: number | null };

export const HEALTH_POLL_MS = 20_000;
const MAX_SAMPLES = 16;

// Polls /healthz while the tab is visible and records round-trip times.
export function useHealth() {
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const probeRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let busy = false;
    let timer: number | undefined;

    const probe = async () => {
      window.clearTimeout(timer);
      if (busy) return;
      if (!apiConfigured()) {
        getHealth().then((h) => {
          if (alive) setHealth(h);
        });
        return;
      }
      if (!document.hidden) {
        busy = true;
        const started = performance.now();
        const h = await getHealth();
        busy = false;
        if (!alive) return;
        const ms = h ? Math.round(performance.now() - started) : null;
        setHealth(h);
        setSamples((s) => [...s.slice(1 - MAX_SAMPLES), { at: Date.now(), ms }]);
      }
      timer = window.setTimeout(probe, HEALTH_POLL_MS);
    };

    const onVisible = () => {
      if (!document.hidden) void probe();
    };

    probeRef.current = () => void probe();
    void probe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refresh = () => probeRef.current();
  return { health, samples, refresh };
}
