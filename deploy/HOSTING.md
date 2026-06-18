# Hosting & Configuration

This is the recommended way to upload, host, and configure Tartarus. It's chosen to be cheap
(generous free tiers, scale-to-zero), to match the rest of the portfolio, and to make the security
story *true at the infrastructure level* — not just in the app.

## The topology

```
              Vercel                         Fly.io (Firecracker microVM)
        ┌──────────────────┐            ┌─────────────────────────────────┐
visitor │  web/  (Next.js  │  HTTPS     │  tartarus-api (Rust)            │
 ─────▶ │  Monaco IDE +    │ ─────────▶ │  gateway + worker + WASM sandbox│
        │  Escape Arena)   │            │                                 │
        └──────────────────┘            └───────┬──────────────┬──────────┘
                 ▲ embedded in the                │ jobs/results  │ audit/escapes
                 │ portfolio's live-preview        ▼              ▼
                 │ iframe                    Upstash Redis    Neon Postgres
```

| Piece | Host | Why |
| --- | --- | --- |
| `web/` (IDE + Arena) | **Vercel** | Same platform as the portfolio; instant Next.js deploys; free. |
| `tartarus-api` (gateway+worker) | **Fly.io** | Docker app that runs **inside a Firecracker microVM** — the WASM sandbox inherits microVM isolation for free. Scale-to-zero ≈ free when idle. Untrusted code must *not* run on shared serverless. |
| Queue / result cache | **Upstash Redis** | Serverless Redis, `rediss://` TLS, free tier. |
| Audit + escape attempts | **Neon Postgres** | Serverless Postgres, `sslmode=require`, free tier. |

> This Vercel + Fly + managed-data pattern is the template the sibling projects reuse: **Labyrinth**
> deploys the same way; **Siren**'s honeypot sensors instead want a dedicated throwaway VPS (it
> needs to *accept* hostile inbound traffic), with Tartarus called for malware detonation.

---

## 0. Local first (zero services)

```bash
# Terminal 1 — the API (in-memory queue + store, no Redis/Postgres needed)
./runtimes/fetch-runtimes.sh           # or: powershell -File runtimes\fetch-runtimes.ps1
cargo run -p tartarus-server -- all    # http://localhost:8080

# Terminal 2 — the web IDE
cd web && cp .env.example .env.local   # NEXT_PUBLIC_TARTARUS_API=http://localhost:8080
npm install && npm run dev             # http://localhost:3000
```

Prod-parity locally (Redis + Postgres + API in containers):

```bash
docker compose -f deploy/docker-compose.yml up --build
```

---

## 1. Postgres — Neon

1. Create a project at <https://neon.tech>.
2. Copy the connection string (looks like `postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Schema is applied automatically on first boot (`PgStore::connect`); `migrations/0001_init.sql`
   is the canonical copy if you'd rather run it by hand.

## 2. Redis — Upstash

1. Create a database at <https://upstash.com>.
2. Copy the **`rediss://`** URL (TLS — the binary is built with the rustls Redis feature).

## 3. API — Fly.io

```bash
# one-time
curl -L https://fly.io/install.sh | sh        # or: brew install flyctl
fly auth login

# from the repo root (uses deploy/fly.toml + deploy/Dockerfile)
fly launch --copy-config --no-deploy          # accept app name, region

fly secrets set \
  DATABASE_URL="postgres://...neon.tech/neondb?sslmode=require" \
  REDIS_URL="rediss://...upstash.io:6379"

fly deploy
```

The Docker build compiles the Rust binary with `--features distributed` and **bakes the interpreter
runtimes into the image** (`runtimes/fetch-runtimes.sh` runs at build time). Confirm it's up:

```bash
curl https://<your-app>.fly.dev/healthz
```

Scaling note: `fly.toml` runs one machine as `tartarus all` (gateway + worker) with scale-to-zero.
For more throughput, switch to process groups — `gateway = "serve"`, `worker = "worker"` — and keep
at least one worker machine running.

## 4. Web — Vercel

1. Import the repo at <https://vercel.com>, set the **Root Directory** to `web/`.
2. Environment variables:
   - `NEXT_PUBLIC_TARTARUS_API` = `https://<your-app>.fly.dev`
   - `PORTFOLIO_ORIGIN` = your portfolio origin, e.g. `https://leonardo-nguyen.vercel.app` *(optional;
     locks iframe embedding to your site — otherwise any `https:` site may embed the preview)*
3. Deploy. The build command is `next build` (no extra config).

CORS is already permissive on the API; embedding works because the web app sends
`Content-Security-Policy: frame-ancestors` (not `X-Frame-Options: DENY`) — see `web/next.config.mjs`.

## 5. Wire it into the portfolio

The portfolio's `run` command opens a project's live URL in its preview iframe. Point Tartarus's
`live` link at the deployed Vercel URL (already added to `portfolio/src/data/projects.ts`). Because
the web app allows framing, it renders inside the portfolio's live-preview window.

---

## Cost & safety

- **Cost:** All four services have free tiers; Fly scales to zero when idle. Set billing alerts.
- **Isolation:** untrusted code never executes as native code — it runs as WASM under wasmtime
  (no network, no host FS, hard CPU/mem/wall-clock/output caps), and on Fly that runs inside a
  Firecracker microVM. One ephemeral sandbox per run; nothing persists.
- **Kill switch:** `fly scale count 0` stops all execution immediately.
- **Escape Arena:** a host canary is generated per attempt and never handed to the sandbox; if it
  ever appears in guest output the worker logs an escape success and pages (`tracing::error!`).

## Future: gVisor / Firecracker per-run backends

These v2/v3 backends (`crates/tartarus-core/src/backend.rs`) need a Linux host with `runsc` / KVM.
Stand up a bare-metal Fly machine or a dedicated VPS, install the runtime, implement `Backend::run`
for that backend, and select it per job. The gateway/queue/worker/contract stay exactly as they are
— that's the point of the `Backend` trait.
