# Tartarus - Secure Code Execution Sandbox

> A service that executes untrusted, attacker-controlled code safely and reproducibly - hardened
> enough to host hostile workloads, and confident enough to invite escape attempts.

Tartarus exposes one tiny contract - *"run this code with these limits; return its output and a
trace of everything it tried to do"* - behind a pluggable isolation backend. v1 ships a real
**WebAssembly/WASI** backend (wasmtime): untrusted code runs as WASM bytecode with **no network, no
host filesystem, and no ambient authority**, under hard CPU, memory, wall-clock, and output limits.
It is the isolation engine for the **Labyrinth** CTF and the **Siren** honeypot's malware
detonation, and it ships with a public **Escape Arena** that logs (failed) breakout attempts.

```
web (Next.js / Vercel) ──HTTP──▶ gateway (axum) ──enqueue──▶ queue ──▶ worker
  Monaco IDE · trace · arena        validate/clamp           Redis│mem    │ wasmtime + WASI sandbox
        ▲                                                          ▼        ▼  (one ephemeral Store per run)
        └────────────── result + syscall-style trace ◀──────── store ◀──────┘
                                                          Postgres│mem
```

## Internals

- **WASM/WASI isolation (wasmtime):** fuel metering (CPU), epoch interruption (wall-clock), a
  `ResourceLimiter` (memory), capped output pipes, and a capability-scoped WASI context - empty env,
  no sockets, a read-only `/sandbox` and a small writable `/tmp`, nothing else.
- **Languages:** Python (CPython·WASI) and JavaScript (QuickJS·WASI), run from pinned interpreter
  modules. Adding a language is a few lines in `crates/tartarus-core/src/lang.rs`.
- **Syscall-style trace:** the host records what each run *attempted* - provisioning, I/O, and every
  limit it tripped - and renders it in a terminal-style panel.
- **Escape Arena:** a per-run canary lives only on the host and is never given to the sandbox. If it
  ever shows up in guest output, that's a real breach - logged, surfaced on a leaderboard, paged on.
- **Pluggable backends:** `Backend` is a trait. gVisor and Firecracker per-run backends are designed
  in and documented (they need a Linux/KVM host); WASM is the one built today.

## Layout

| Path | What |
| --- | --- |
| `crates/tartarus-core` | The isolation engine: run contract, limits, `Backend` trait, wasmtime sandbox, trace. |
| `crates/tartarus-server` | axum gateway + worker pool + queue/store (in-memory or Redis/Postgres) + CLI, plus the Labyrinth CTF API. |
| `web/` | Next.js IDE: Monaco editor, output + trace panels, Escape Arena, and Labyrinth CTF route. |
| `runtimes/` | Fetch scripts + lockfile for the WASI interpreter modules. |
| `deploy/` | Dockerfile, Fly + docker-compose, and **[HOSTING.md](deploy/HOSTING.md)**. |
| `migrations/` | Postgres schema (distributed mode). |
| `docs/labyrinth-architecture.md` | Labyrinth architecture, API map, security notes, and verification flow. |

## Quickstart (zero external services)

```bash
# 1. Fetch the interpreter runtimes (~once)
./runtimes/fetch-runtimes.sh                 # Windows: powershell -File runtimes\fetch-runtimes.ps1

# 2. Run one snippet straight through the sandbox - no server needed
cargo run -p tartarus-server -- run --lang python --code "print('hello from inside Tartarus')"

# 3. Or run the full service (gateway + worker, in-memory)
cargo run -p tartarus-server -- all          # http://localhost:8080

# 4. And the web IDE
cd web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000
```

Labyrinth runs from the same gateway. Point the web app at the API and open
`http://localhost:3000/labyrinth`:

```bash
NEXT_PUBLIC_TARTARUS_API=http://localhost:8080 npm run dev
```

Watch the limits work:

```bash
cargo run -p tartarus-server -- run --lang python --wall-ms 1500 --code "while True: pass"   # -> killed
cargo run -p tartarus-server -- run --lang python --memory-mb 128 --code "bytearray(2*1024**3)" # -> oom
```

## Testing

```bash
./runtimes/fetch-runtimes.sh        # tests that need an interpreter skip gracefully without this
cargo test -p tartarus-core         # hello-world, CPU spin, memory bomb, output flood, host-fs denied
```

## API

| Method | Path | |
| --- | --- | --- |
| `POST` | `/run` | `{lang, source, stdin?, limits?, mode?, technique?}` → `{id}` |
| `GET` | `/run/:id` | `{status:"pending"}` or `{status:"done", result}` |
| `GET` | `/run/:id/ws` | WebSocket: status frames, then the final `done` frame |
| `GET` | `/languages` | available languages |
| `GET` | `/arena/leaderboard` | attempts + escapes by technique |
| `GET` | `/labyrinth/event` | Labyrinth event metadata, challenge summary, scoreboard |
| `POST` | `/labyrinth/teams` | create a Labyrinth team |
| `GET` | `/labyrinth/teams/:id/board` | team-scoped Labyrinth board |
| `POST` | `/labyrinth/teams/:id/submissions` | submit a dynamic Labyrinth flag |
| `GET` | `/healthz` | status, backend, languages, max limits |

`RunResult`: `{stdout, stderr, exitCode, durationMs, timedOut, oom, outputTruncated, outcome,
fuelUsed, trace[], escape?}`.

## Hosting

Frontend → **Vercel**, API → **Fly.io** (Firecracker microVM), Redis → **Upstash**, Postgres →
**Neon**. Local dev needs none of them. Full walkthrough in **[deploy/HOSTING.md](deploy/HOSTING.md)**.

## Roadmap

- **M1 (this)** - gateway + WASM worker + Python/JS + limits + web IDE + trace + Escape Arena.
- **M2** - gVisor backend (native binaries), deterministic mode, per-write trace, Redis-TTL result cache.
- **M3** - Firecracker per-run microVM backend, backend bake-off, API keys + per-tenant quotas, autoscaling.

## License

MIT - see [LICENSE](LICENSE).
