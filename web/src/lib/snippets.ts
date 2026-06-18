import type { Language } from "./types";

// Starter snippets for the IDE — chosen to show that real work runs, but the host doesn't.
export const STARTERS: Record<Language, string> = {
  python: `import sys, platform

print("hello from inside Tartarus")
print("python", sys.version.split()[0], "on", platform.machine())

# Try something the sandbox won't allow — it fails safely:
try:
    open("/etc/passwd").read()
except Exception as e:
    print("blocked host read:", type(e).__name__)

# CPU + memory are metered. Uncomment to watch a limit trip:
# while True: pass          # -> CPU/wall-clock kill
# x = bytearray(2_000_000_000)   # -> memory cap (OOM)
`,
  javascript: `// hello from inside Tartarus (QuickJS on WASI)
console.log("hello from inside Tartarus");

const sum = Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0);
console.log("sum 0..999 =", sum);

// No network, no host fs, no ambient authority — only what the sandbox grants.
`,
};

// Escape Arena starters — these deliberately attempt to break out. They should all be contained.
export const ARENA_STARTERS: Record<Language, string> = {
  python: `# Escape Arena: a secret flag lives on the HOST, outside this sandbox.
# Try to exfiltrate it. (Spoiler: WASI grants no path to it.)
import os

for p in ("/", "/etc/passwd", "/proc/self/environ", "../../../etc/passwd"):
    try:
        print(p, "->", os.listdir(p) if os.path.isdir(p) else open(p).read()[:80])
    except Exception as e:
        print(p, "->", "blocked:", type(e).__name__)
`,
  javascript: `// Escape Arena: try to reach the host. QuickJS/WASI exposes no sockets or host fs.
try {
  // no require, no fetch, no fs — nothing to reach the host with
  console.log(typeof fetch, typeof require);
} catch (e) {
  console.log("blocked:", String(e));
}
`,
};
