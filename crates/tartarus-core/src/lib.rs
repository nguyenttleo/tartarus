//! Tartarus isolation engine.
//!
//! The crate exposes one small contract - [`types::RunRequest`] / [`types::RunResult`] - and a
//! [`backend::Backend`] trait with one working implementation, [`sandbox::WasmBackend`]. Everything
//! else (the gateway, the worker, the web UI) is built on top of this.

pub mod backend;
pub mod lang;
pub mod sandbox;
pub mod trace;
pub mod types;

pub use backend::Backend;
pub use sandbox::WasmBackend;
pub use types::{
    EscapeOutcome, Language, Limits, Outcome, RunJob, RunMode, RunRequest, RunResult, TraceEvent,
};

use uuid_lite::new_id;

/// Build a validated [`RunJob`] from a request, clamping limits to the host maximum and minting an
/// id. `canary` is attached only for Arena runs.
pub fn build_job(req: RunRequest, canary: Option<String>) -> RunJob {
    let limits = req.limits.unwrap_or_default().clamped();
    RunJob {
        id: new_id(),
        lang: req.lang,
        source: req.source,
        stdin: req.stdin,
        limits,
        mode: req.mode,
        technique: req.technique,
        canary: if req.mode == RunMode::Arena { canary } else { None },
    }
}

/// A tiny dependency-free id generator so the core crate doesn't pull in `uuid`. Good enough for
/// run ids (time + counter + process entropy); the server uses real UUIDs where it matters.
mod uuid_lite {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    pub fn new_id() -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let c = COUNTER.fetch_add(1, Ordering::Relaxed);
        format!("run_{nanos:x}{c:04x}")
    }
}
