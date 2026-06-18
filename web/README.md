# Tartarus — Web IDE

The Next.js front end for Tartarus: a Monaco-based code IDE, an output + syscall-trace console, and
the Escape Arena. It talks to the Rust gateway over HTTP; it runs no code itself.

## Develop

```bash
npm install
cp .env.example .env.local        # point NEXT_PUBLIC_TARTARUS_API at your gateway
npm run dev                       # http://localhost:3000
```

Run the gateway alongside it (from the repo root):

```bash
cargo run -p tartarus-server -- all      # http://localhost:8080
```

## Configuration

| Env var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_TARTARUS_API` | Base URL of the Tartarus gateway. If unset, the UI shows a "backend not connected" state and never fabricates results. |
| `PORTFOLIO_ORIGIN` | Optional. Locks iframe embedding to your portfolio's origin (otherwise any `https:` site may embed the live preview). |

## Deploy

Optimized for Vercel: import the `web/` directory, set `NEXT_PUBLIC_TARTARUS_API`, deploy. The
`frame-ancestors` header (configured in `next.config.mjs`) lets the portfolio embed this app in its
live-preview window. See `../deploy/HOSTING.md`.
