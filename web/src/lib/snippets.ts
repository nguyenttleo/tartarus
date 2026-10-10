import type { Language } from "./types";

export const STARTERS: Record<Language, string> = {
  python: `import sys, platform

print("hello from inside Tartarus")
print("python", sys.version.split()[0], "on", platform.machine())

try:
    open("/etc/passwd").read()
except Exception as e:
    print("blocked host read:", type(e).__name__)

`,
  javascript: `console.log("hello from inside Tartarus");

const sum = Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0);
console.log("sum 0..999 =", sum);

`,
};

export const ARENA_STARTERS: Record<Language, string> = {
  python: `import os

for p in ("/", "/etc/passwd", "/proc/self/environ", "../../../etc/passwd"):
    try:
        print(p, "->", os.listdir(p) if os.path.isdir(p) else open(p).read()[:80])
    except Exception as e:
        print(p, "->", "blocked:", type(e).__name__)
`,
  javascript: `try {
  console.log(typeof fetch, typeof require);
} catch (e) {
  console.log("blocked:", String(e));
}
`,
};
