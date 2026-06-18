-- Tartarus schema (distributed mode). Applied idempotently on startup by PgStore::connect;
-- kept here as the canonical reference and for running by hand / with a migration tool.

CREATE TABLE IF NOT EXISTS runs (
    id          TEXT PRIMARY KEY,
    lang        TEXT NOT NULL,
    backend     TEXT NOT NULL,
    outcome     TEXT NOT NULL,
    exit_code   INT,
    duration_ms BIGINT NOT NULL,
    timed_out   BOOLEAN NOT NULL,
    oom         BOOLEAN NOT NULL,
    payload     TEXT NOT NULL,            -- full RunResult as JSON
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escape_attempts (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL,
    technique   TEXT NOT NULL,
    succeeded   BOOLEAN NOT NULL,
    notes       TEXT NOT NULL,
    lang        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id            TEXT PRIMARY KEY,
    owner         TEXT NOT NULL,
    hashed_key    TEXT NOT NULL,
    quota_per_min INT NOT NULL DEFAULT 60,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escape_attempts_technique ON escape_attempts (technique);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs (created_at);
