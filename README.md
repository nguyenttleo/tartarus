# Tartarus

Tartarus is a secure code execution sandbox I built for running untrusted code with strict limits and a visible audit trail.

The basic contract is small: send code, choose limits, get back stdout, stderr, exit status, timing, resource flags, and a host-observed trace of what the run attempted.

## What It Does

- Runs Python and JavaScript through pinned WASI interpreter modules
- Uses Wasmtime to isolate each run from the host
- Blocks network access and host filesystem access
- Enforces wall-clock, CPU, memory, and output limits
- Records a syscall-style trace for provisioning, I/O, and denied actions
- Includes an Escape Arena for testing breakout attempts against a host-only canary

## Architecture

```text
Next.js IDE -> Rust gateway -> queue -> worker -> Wasmtime/WASI sandbox
      ^                                                   |
      +------------- result, output, and trace ------------+
```

Local development can run fully in memory. Distributed mode can use Redis for the queue and Postgres for stored results and arena history.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `crates/tartarus-core` | Sandbox engine, limits, trace events, backend trait, and Wasmtime/WASI implementation |
| `crates/tartarus-server` | Axum API, worker pool, queue/store adapters, and CLI |
| `web/` | Next.js IDE with Monaco, output panels, trace view, and Escape Arena |
| `runtimes/` | Scripts and lockfile for the WASI interpreter modules |
| `deploy/` | Docker, Fly.io, docker-compose, and hosting notes |
| `migrations/` | Postgres schema for distributed mode |

## Quickstart

Fetch the interpreter runtimes first:

```bash
./runtimes/fetch-runtimes.sh
```

On Windows:

```powershell
powershell -File runtimes\fetch-runtimes.ps1
```

Run a snippet without starting the web app:

```bash
cargo run -p tartarus-server -- run --lang python --code "print('hello from Tartarus')"
```

Start the API and worker together:

```bash
cargo run -p tartarus-server -- all
```

The API listens on `http://localhost:8080`.

Start the web IDE:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Set this in `web/.env.local` if it is not already there:

```text
NEXT_PUBLIC_TARTARUS_API=http://localhost:8080
```

The web app runs at `http://localhost:3000`.

## Limit Checks

These are useful sanity checks when changing the sandbox:

```bash
cargo run -p tartarus-server -- run --lang python --wall-ms 1500 --code "while True: pass"
cargo run -p tartarus-server -- run --lang python --memory-mb 128 --code "bytearray(2*1024**3)"
```

The first should time out. The second should hit the memory limit.

## Testing

```bash
./runtimes/fetch-runtimes.sh
cargo test -p tartarus-core
```

The sandbox tests cover normal execution, CPU spin, memory pressure, output flooding, and denied host filesystem access.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/run` | Enqueue a run |
| `GET` | `/run/:id` | Poll for a result |
| `GET` | `/run/:id/ws` | Stream status frames over WebSocket |
| `GET` | `/languages` | List supported languages |
| `GET` | `/arena/leaderboard` | Show arena attempts and escapes |
| `GET` | `/healthz` | Check backend, uptime, languages, and limits |

`POST /run` accepts:

```json
{
  "lang": "python",
  "source": "print('hello')",
  "stdin": "",
  "limits": {
    "wallMs": 5000,
    "fuel": 1000000000,
    "memoryBytes": 134217728,
    "outputBytes": 262144
  },
  "mode": "normal",
  "technique": null
}
```

## Hosting

The intended deployment is:

| Piece | Host |
| --- | --- |
| Web app | Vercel |
| API and worker | Fly.io |
| Queue | Upstash Redis |
| Results and arena history | Neon Postgres |

Local development does not need any of those services. See `deploy/HOSTING.md` for the full setup.

## Roadmap

- Current: WASM backend, Python, JavaScript, limits, trace output, web IDE, and Escape Arena
- Next: gVisor backend, deterministic mode, stronger trace detail, and Redis-backed result caching
- Later: Firecracker per-run backend, API keys, tenant quotas, and autoscaling

## License

MIT. See `LICENSE`.
