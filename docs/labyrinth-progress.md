# Labyrinth Progress Log

> Running implementation journal for the Labyrinth CTF inside Tartarus.

## 2026-06-17

### 19:20 - Initial read-through
- Read `project-specs/README.md`, `project-specs/labyrinth-ctf.md`, Tartarus `README.md`, workspace `Cargo.toml`, the Rust gateway, store, and current Next.js app.
- Confirmed Tartarus currently owns the deployable Rust API plus Next.js web shell; Labyrinth will be built inside the Tartarus folder as a first-class CTF module and route.
- Noted an existing uncommitted change in `crates/tartarus-core/tests/sandbox.rs`; leaving it untouched as concurrent local work.
- Implementation direction: Rust in-memory CTF engine/API for teams, dynamic flags, gating, scoring, rate limits, hints, instances, scoreboard, and challenge actions; Next.js player/admin surface at `/labyrinth`.

### 19:45 - Labyrinth server module
- Added `crates/tartarus-server/src/labyrinth.rs` and mounted it under `/labyrinth` in the existing Axum gateway.
- Implemented seeded six-stage LeoOS challenge catalog, team creation, board state, sequential kill-chain gating, HMAC dynamic flags, decay scoring, first bloods, hint unlocks with point cost, per-team instance records, challenge action simulators, shared-flag fingerprinting, submission throttling, scoreboard, and JSON export.
- Added workspace dependencies `hmac` and `sha2` for real dynamic-flag derivation.
- Test: `C:\Users\leots\.cargo\bin\cargo.exe test -p tartarus-server labyrinth` passed, 5 tests covering dynamic flags, gating, scoring/unlock, shared flag rejection, and rate limiting.
- Note: `cargo fmt` could not run because `rustfmt` is not installed for the active Rust toolchain.

### 20:15 - Labyrinth web surface
- Added typed web client `web/src/lib/labyrinth.ts` for the new Rust API contract.
- Added `/labyrinth` route with team registration, persisted local team session, kill-chain board, active challenge workbench, per-team instance launch, artifact display, flag submission, hint unlocks, scoreboard, solve feed, and admin JSON export.
- Updated the shared site header to include Labyrinth next to the IDE and Escape Arena.
- Updated ESLint config to use the native flat Next.js exports and pinned ESLint to the compatible 9.x major so lint runs against real app code.
- Test: `npm run lint` passed.
- Test: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.

### 20:25 - Architecture docs
- Added `docs/labyrinth-architecture.md` with runtime diagram, server/web ownership, API table, security notes, local run steps, and end-to-end verification flow.
- Updated the root README layout, quickstart, and API table to include Labyrinth as a built-in Tartarus surface.

### 20:40 - Automated verification pass
- Installed the missing `rustfmt` component for the active Rust toolchain.
- Test: `C:\Users\leots\.cargo\bin\cargo.exe test --workspace` passed. Tartarus core ran 8 sandbox tests and Tartarus server ran 5 Labyrinth tests.
- Formatting: `rustfmt --edition 2021 --check` passed for touched Rust files `api.rs`, `main.rs`, and `labyrinth.rs`.
- Test: `C:\Users\leots\.cargo\bin\cargo.exe test -p tartarus-server labyrinth` passed after formatting.
- Test: `npm run lint` passed.
- Test: `npm run build` passed.
- Note: workspace-wide `cargo fmt --check` still reports pre-existing formatting drift in other Rust files, so only the files touched for Labyrinth were formatted to avoid unrelated churn.

### 20:55 - Browser end-to-end verification
- Started the real Tartarus API at `http://127.0.0.1:8080` and the real Next.js app at `http://127.0.0.1:3000`.
- Added ignored local test config `web/.env.local` with `NEXT_PUBLIC_TARTARUS_API=http://127.0.0.1:8080`.
- Browser test: created team `e2e-93652`, launched the Parser Poltergeist instance, ran the avatar exploit, submitted the returned dynamic flag, verified score increase and Prompt & Circumstance unlock.
- Browser test: completed all six stages through the UI: Prompt & Circumstance, Henderson's Gambit, Desync, Schrodinger's Session, and Cold Boot.
- Final browser state: `6/6` solved, `100%` progress, score `3775`, final writeup unlocked, scoreboard updated.
- Found and fixed stale artifact state after auto-advancing to the next challenge by scoping action results to the active challenge slug.
- Found and fixed a React hydration mismatch caused by reading `localStorage` during the first client render; replaced it with `useSyncExternalStore`.
- Responsive browser check: at `390x844`, no horizontal overflow (`scrollWidth == clientWidth`), board and final challenge still visible.

### 21:05 - Dedicated review pass
- Reviewed final diff/status and removed accidental rustfmt-only churn in unrelated `store.rs` and `worker.rs`.
- Added optional hosted-event hardening: if `LABYRINTH_ADMIN_TOKEN` is set, `/labyrinth/export` requires `x-labyrinth-admin-token`.
- Added test coverage for the admin export guard; `C:\Users\leots\.cargo\bin\cargo.exe test -p tartarus-server labyrinth` now passes 6 tests.
- Patched the Monaco transitive DOMPurify advisory with an npm override to `dompurify@3.4.11`.
- Audit note: `npm audit --omit=dev --audit-level=moderate` initially reported a nested Next/PostCSS advisory; this was resolved in the later UI review pass with a targeted PostCSS override instead of the breaking downgrade proposed by `npm audit fix --force`.
- Final checks: `npm run lint` passed, `npm run build` passed, `git diff --check` passed except normal Windows LF/CRLF warnings.
- Restarted the local API after backend hardening; final services are live at `http://127.0.0.1:8080` and `http://127.0.0.1:3000/labyrinth`.

### 21:20 - Senior frontend UI revamp
- Rebuilt `/labyrinth` as a full-viewport operations console with a dense command bar, dedicated kill-chain rail, primary challenge workspace, artifact/flag lane, hints, scoreboard, and activity/export rail.
- Added `lucide-react` and replaced text-heavy controls with icon-led buttons, compact status chips, KPI counters, and responsive panel sections that use the available width instead of leaving the center surface underfilled.
- Reworked the page shell to use a bounded `h-dvh` app frame with internal scrolling; desktop keeps a full-height three-column console while mobile stacks panels with natural content height.
- Browser test: created a fresh team through the UI, launched the first stage instance, ran the workbench action, submitted the returned dynamic flag, verified score `500`, progress `1/6`, next-stage activation, scoreboard update, and no browser console errors.
- Desktop layout check at the default browser viewport: document `scrollWidth == clientWidth` and `scrollHeight == clientHeight`; three visible grid columns measured at `318px`, `554px`, and `360px`.
- Mobile layout check at `390x844`: no horizontal overflow, main surface scrolls internally, all stacked panels remain visible, and the right rail no longer collapses.
- Added a targeted npm override for nested PostCSS consumers; `npm audit --omit=dev --audit-level=moderate` now reports `found 0 vulnerabilities`.
- Final UI checks: `npm run lint` passed and `npm run build` passed.

### 21:40 - Tartarus redesign alignment
- Refitted `/labyrinth` to the redesigned Tartarus terminal UI: shared `titlebar`, `screen`, `chip`, `field`, `btn-*`, `progress`, `win-dots`, `GlitchText`, and `Ticker` patterns now drive the Labyrinth entry screen, command bar, kill-chain rail, workspace, artifact lane, hints, scoreboard, and activity panels.
- Preserved the full-viewport operations layout while matching the new `visitor@tartarus` prompt language, CRT-safe screen surfaces, terminal typography, and max-width rhythm used by the redesigned IDE and Escape Arena.
- Browser test: reset the local session, created team `tartarus-ui-y7532`, launched Parser Poltergeist, ran `Send avatar`, submitted the returned dynamic flag, and verified score `450`, progress `1/6`, stage 2 activation, scoreboard update, and no console errors.
- Found and fixed a stale board race where an in-flight refresh could restore an old team after pressing Reset; stale team responses are now ignored and local workbench input state is cleared on reset.
- Found and fixed a mobile flex-shrink issue where the command bar collapsed to its borders in the stacked layout; mobile stack children now keep natural height while desktop keeps the bounded three-column console.
- Fixed the redesigned shared `BootSequence` lint error by moving boot-overlay state changes into timed callbacks with cleanup.
- Desktop browser layout check: `1280x720`, document `scrollWidth == clientWidth`, document `scrollHeight == clientHeight`, three visible columns measured at `318px`, `538px`, and `360px`, no panel overflow.
- Mobile browser layout check: `390x844`, no horizontal overflow, command bar height preserved, kill-chain/workspace/scoreboard visible, no panel horizontal overflow.
- Final checks: `npm run lint` passed, `npm run build` passed, and `npm audit --omit=dev --audit-level=moderate` reported `found 0 vulnerabilities`.

### 21:50 - Session flash fix
- Fixed a load-time flash where the redesigned Labyrinth entry screen could be replaced by an older saved board after hydration because the browser still had the legacy `labyrinth.teamId` key.
- Versioned the persisted team key to `labyrinth.tartarusUi.teamId`, clear legacy Labyrinth session keys on load/store/reset, and added a terminal-style resume panel for valid new sessions while their board is fetched.
- Browser test: with no new session key, reload stays on the redesigned join screen and does not resurrect the previous board; after joining `session-fix-yh0t7`, reload resumes directly into the redesigned board; after Reset plus reload, the redesigned join screen remains stable.
- Verification: `npm run lint` passed and `npm run build` passed.

### 21:55 - Join widget polish
- Reduced the empty vertical space in the `join-session` panel by top-aligning the form stack instead of vertically centering it in the tall widget.
- Replaced the generic `JOIN EVENT` label and person icon with a Tartarus-style terminal prompt, `$ ./join --event leoOS`, using the shared terminal icon.
- Browser check: live join widget measured `24px` between the titlebar and command label, no horizontal overflow, and no browser console errors.
- Verification: `npm run lint` passed and `npm run build` passed.

### 22:15 - Em dash removal
- Removed the em dash character from app UI text, docs, configuration comments, and Rust source strings across the Tartarus workspace.
- Verification: `rg -n "\u2014" .` returns no matches.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Verification: `CARGO_TARGET_DIR=target/codex-test cargo test -p tartarus-core` passed with 8 sandbox tests.
- Verification: `CARGO_TARGET_DIR=target/codex-test cargo test -p tartarus-server` passed with 6 Labyrinth tests.
- Browser check: loaded `/`, `/arena`, and `/labyrinth`, then joined Labyrinth with a fresh team through the live UI; rendered text had no em dash characters and the fresh join produced no 4xx responses.

### 22:35 - Labyrinth systems styling pass
- Replaced the generic stock icons in the Labyrinth metrics and event systems panel with custom terminal module glyphs such as `ST/06/GATE`, `EV/I-O/SYS`, `F{}/HMAC`, and `PTS/DEC`.
- Restyled the event systems panel as an `eventctl` telemetry block with scoped API, flag, and scoring rows instead of a plain settings card.
- Preserved `leoOS` brand casing in titlebar text, terminal commands, event copy, ticker facts, telemetry copy, and the recovery-token default.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` rendered module glyph variants `chain`, `hmac`, `decay`, `event`, `api`, `flags`, and `score`; rendered text preserved `leoOS`/`LeoOS` casing with no legacy lowercase or forced all-caps brand form; no horizontal overflow at `1280px`.

### 22:45 - Removed Labyrinth module glyphs
- Removed the custom module glyph blocks from the Labyrinth metric widgets, event systems header, and event systems rows.
- Rebalanced the metric cards and telemetry rows so text fills the available width without leaving icon columns behind.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` had zero module-glyph elements, no leftover glyph text, preserved `leoOS`/`LeoOS` casing, and no horizontal overflow at `1280px`.

### 22:55 - Labyrinth event copy clarity
- Rewrote the Labyrinth summary cards from implementation-heavy labels to player-facing copy: `6 stages`, `team-specific`, and `decay scoring`.
- Replaced the event systems telemetry wording with clearer event basics for connection, flags, and scoring while keeping the terminal panel styling.
- Removed the remaining separate prompt span before the event rules command so the header reads as one plain terminal line.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` showed the clearer labels, had zero module glyphs, contained no old jargon strings, preserved `leoOS`/`LeoOS` casing, and had no horizontal overflow at `1280px`.

### 23:05 - Event rules consolidation
- Moved the `6 stages`, `team-specific`, and `decay scoring` summary cards from the main Labyrinth intro into the `event.rules` panel.
- Kept the connection status inside `event.rules` below the three player-facing event basics.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` had three summary cards inside `event.rules`, zero summary cards in the intro column, no old jargon strings, preserved `leoOS`/`LeoOS` casing, and no horizontal overflow at `1280px`.

### 23:15 - Event rules row styling
- Restyled the first three `event.rules` basics to match the compact connection row treatment.
- Removed the three helper captions under those rows.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` had four matching `event.rules` rows, zero metric-card rows in that panel, the removed helper text was absent, and no horizontal overflow at `1280px`.

### 23:25 - Event rules compact fit
- Removed the server-status row from the `event.rules` panel so it only contains event length, flags, and scoring basics.
- Made the `event.rules` panel content-height with `h-fit self-start`, preventing it from stretching to the taller join column.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` had three `event.rules` rows, no server-status row, `13px` of bottom padding, no horizontal overflow at `1280x720`, and the same compact fit at `390x844`.

### 23:35 - Stage grid full-width pass
- Removed the entire `cat event.rules` widget and its unused terminal helper code from the Labyrinth join screen.
- Expanded the stage overview into the full left panel width with a responsive two-column desktop grid and single-column narrow layout.
- Increased the stage card visual weight with taller cards, larger titles, larger descriptors, stronger points treatment, and roomier spacing.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Browser check: live `/labyrinth` at `1280x720` rendered all six stage cards in two `372px` columns with `20px` titles, `14px` descriptors, no rules widget text, and no horizontal overflow.
- Browser check: live `/labyrinth` at `390x844` rendered all six stage cards in one `302px` column with `18px` titles, `14px` descriptors, no rules widget text, and no horizontal overflow.

### 23:50 - Stage card depth and flip pass
- Restyled Labyrinth stage cards with a deeper terminal surface, edge lighting, inset glow, faint stage watermark, larger titles, larger descriptions, and a stable no-lift hover state.
- Added click-to-flip stage cards: the front face shows stage, points, title, and kill-chain label; the back face shows the challenge description and category.
- Exposed `description` on the public Labyrinth event challenge payload, with a frontend fallback for older local API processes that have not restarted.
- Verification: `npm run lint` passed.
- Verification: `npm run build` passed; Next generated `/`, `/arena`, and `/labyrinth`.
- Verification: `CARGO_TARGET_DIR=target/codex-test cargo test -p tartarus-server` passed with 6 Labyrinth tests.
- Browser check: live `/labyrinth` at `1280x720` rendered six `176px` stage cards in three columns, flipped the first card to its description on click, kept the box stable, and had no horizontal overflow.
- Browser check: live `/labyrinth` at `390x844` rendered a one-column card layout, flipped the first card to its description on click, fit the back-face content, and had no horizontal overflow.
