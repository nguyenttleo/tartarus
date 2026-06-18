//! Result + audit store. In-memory by default; Postgres in `distributed` builds.
//!
//! Results are looked up by id (the gateway polls / streams them). Escape attempts feed the public
//! Escape Arena leaderboard. (The spec's Redis-TTL result cache is a v2 optimisation; v1 keeps
//! results in the same store as the audit trail.)

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tartarus_core::RunResult;

pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// One recorded escape attempt against the Arena.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EscapeRecord {
    pub id: String,
    pub run_id: String,
    pub technique: String,
    pub succeeded: bool,
    pub notes: String,
    pub lang: String,
    pub created_at_unix: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub technique: String,
    pub attempts: u64,
    pub escapes: u64,
    pub last_seen_unix: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardSummary {
    pub total_attempts: u64,
    pub total_escapes: u64,
    pub techniques: Vec<LeaderboardEntry>,
}

#[derive(Clone)]
pub enum Store {
    InMemory(InMemoryStore),
    #[cfg(feature = "distributed")]
    Postgres(PgStore),
}

impl Store {
    pub async fn save_result(&self, r: &RunResult) -> Result<()> {
        match self {
            Store::InMemory(s) => {
                s.results.lock().unwrap().insert(r.id.clone(), r.clone());
                Ok(())
            }
            #[cfg(feature = "distributed")]
            Store::Postgres(s) => s.save_result(r).await,
        }
    }

    pub async fn get_result(&self, id: &str) -> Result<Option<RunResult>> {
        match self {
            Store::InMemory(s) => Ok(s.results.lock().unwrap().get(id).cloned()),
            #[cfg(feature = "distributed")]
            Store::Postgres(s) => s.get_result(id).await,
        }
    }

    pub async fn record_escape(&self, rec: &EscapeRecord) -> Result<()> {
        match self {
            Store::InMemory(s) => {
                s.escapes.lock().unwrap().push(rec.clone());
                Ok(())
            }
            #[cfg(feature = "distributed")]
            Store::Postgres(s) => s.record_escape(rec).await,
        }
    }

    pub async fn leaderboard(&self) -> Result<LeaderboardSummary> {
        match self {
            Store::InMemory(s) => Ok(s.leaderboard()),
            #[cfg(feature = "distributed")]
            Store::Postgres(s) => s.leaderboard().await,
        }
    }
}

#[derive(Clone, Default)]
pub struct InMemoryStore {
    results: Arc<Mutex<HashMap<String, RunResult>>>,
    escapes: Arc<Mutex<Vec<EscapeRecord>>>,
}

impl InMemoryStore {
    fn leaderboard(&self) -> LeaderboardSummary {
        let escapes = self.escapes.lock().unwrap();
        let mut by_tech: HashMap<String, LeaderboardEntry> = HashMap::new();
        let mut total_attempts = 0u64;
        let mut total_escapes = 0u64;
        for e in escapes.iter() {
            total_attempts += 1;
            if e.succeeded {
                total_escapes += 1;
            }
            let entry = by_tech.entry(e.technique.clone()).or_insert(LeaderboardEntry {
                technique: e.technique.clone(),
                attempts: 0,
                escapes: 0,
                last_seen_unix: 0,
            });
            entry.attempts += 1;
            if e.succeeded {
                entry.escapes += 1;
            }
            entry.last_seen_unix = entry.last_seen_unix.max(e.created_at_unix);
        }
        let mut techniques: Vec<_> = by_tech.into_values().collect();
        techniques.sort_by(|a, b| b.attempts.cmp(&a.attempts).then(b.last_seen_unix.cmp(&a.last_seen_unix)));
        LeaderboardSummary { total_attempts, total_escapes, techniques }
    }
}

/// Schema applied on startup (idempotent). Mirrors `migrations/0001_init.sql`.
#[cfg(feature = "distributed")]
const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    lang TEXT NOT NULL,
    backend TEXT NOT NULL,
    outcome TEXT NOT NULL,
    exit_code INT,
    duration_ms BIGINT NOT NULL,
    timed_out BOOLEAN NOT NULL,
    oom BOOLEAN NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS escape_attempts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    technique TEXT NOT NULL,
    succeeded BOOLEAN NOT NULL,
    notes TEXT NOT NULL,
    lang TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    hashed_key TEXT NOT NULL,
    quota_per_min INT NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"#;

#[cfg(feature = "distributed")]
#[derive(Clone)]
pub struct PgStore {
    pool: sqlx::PgPool,
}

#[cfg(feature = "distributed")]
impl PgStore {
    pub async fn connect(url: &str) -> Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(5)
            .connect(url)
            .await?;
        // Apply schema (idempotent). Split on ';' so each statement runs separately.
        for stmt in SCHEMA_SQL.split(';') {
            let s = stmt.trim();
            if !s.is_empty() {
                sqlx::query(s).execute(&pool).await?;
            }
        }
        Ok(PgStore { pool })
    }

    async fn save_result(&self, r: &RunResult) -> Result<()> {
        let payload = serde_json::to_string(r)?;
        sqlx::query(
            "INSERT INTO runs (id, lang, backend, outcome, exit_code, duration_ms, timed_out, oom, payload)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, outcome = EXCLUDED.outcome",
        )
        .bind(&r.id)
        .bind(r.lang.as_str())
        .bind(&r.backend)
        .bind(format!("{:?}", r.outcome))
        .bind(r.exit_code)
        .bind(r.duration_ms as i64)
        .bind(r.timed_out)
        .bind(r.oom)
        .bind(payload)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn get_result(&self, id: &str) -> Result<Option<RunResult>> {
        use sqlx::Row;
        let row = sqlx::query("SELECT payload FROM runs WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        match row {
            Some(row) => {
                let payload: String = row.try_get("payload")?;
                Ok(Some(serde_json::from_str(&payload)?))
            }
            None => Ok(None),
        }
    }

    async fn record_escape(&self, rec: &EscapeRecord) -> Result<()> {
        sqlx::query(
            "INSERT INTO escape_attempts (id, run_id, technique, succeeded, notes, lang)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&rec.id)
        .bind(&rec.run_id)
        .bind(&rec.technique)
        .bind(rec.succeeded)
        .bind(&rec.notes)
        .bind(&rec.lang)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn leaderboard(&self) -> Result<LeaderboardSummary> {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT technique,
                    COUNT(*)::BIGINT AS attempts,
                    COUNT(*) FILTER (WHERE succeeded)::BIGINT AS escapes,
                    EXTRACT(EPOCH FROM MAX(created_at))::BIGINT AS last_seen
             FROM escape_attempts
             GROUP BY technique
             ORDER BY attempts DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut techniques = Vec::new();
        let mut total_attempts = 0u64;
        let mut total_escapes = 0u64;
        for row in rows {
            let attempts: i64 = row.try_get("attempts")?;
            let escapes: i64 = row.try_get("escapes")?;
            let last_seen: Option<i64> = row.try_get("last_seen").ok();
            total_attempts += attempts as u64;
            total_escapes += escapes as u64;
            techniques.push(LeaderboardEntry {
                technique: row.try_get("technique")?,
                attempts: attempts as u64,
                escapes: escapes as u64,
                last_seen_unix: last_seen.unwrap_or(0),
            });
        }
        Ok(LeaderboardSummary { total_attempts, total_escapes, techniques })
    }
}
