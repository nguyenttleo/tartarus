import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// "⌘" on Apple platforms, "Ctrl" elsewhere and on the server.
export function useModKey(): string {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
