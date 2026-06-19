//! The Tartarus run contract: the tiny, stable surface shared by the gateway, the worker and
//! the web client. "Run this code with these limits; return its output and a trace of everything
//! it tried to do."

use serde::{Deserialize, Serialize};

/// Languages Tartarus can execute. Each maps to a pinned WASI interpreter module (see `lang.rs`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Python,
    Javascript,
}

impl Language {
    pub fn as_str(self) -> &'static str {
        match self {
            Language::Python => "python",
            Language::Javascript => "javascript",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "python" | "py" => Some(Language::Python),
            "javascript" | "js" | "node" => Some(Language::Javascript),
            _ => None,
        }
    }
}

/// Per-run resource caps. These are *requested* limits; the gateway clamps them to the deployment's
/// hard maximums (`Limits::MAX`) before a job is ever enqueued, so a client can ask for less but
/// never more than the host allows.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    /// Wall-clock budget. Enforced by epoch interruption from a background ticker.
    pub wall_ms: u64,
    /// CPU budget as wasmtime "fuel" units (roughly one unit per executed instruction).
    pub fuel: u64,
    /// Maximum linear-memory size the guest may grow to, in bytes.
    pub memory_bytes: u64,
    /// Maximum combined stdout+stderr bytes captured; output past this is dropped and flagged.
    pub output_bytes: u64,
}

impl Limits {
    /// Hard ceiling for a public deployment. Requests are clamped to this.
    pub const MAX: Limits = Limits {
        wall_ms: 10_000,
        fuel: 10_000_000_000,
        memory_bytes: 512 * 1024 * 1024,
        output_bytes: 1024 * 1024,
    };

    /// Clamp every field to `MAX`, returning the safe-to-run limits.
    pub fn clamped(self) -> Limits {
        Limits {
            wall_ms: self.wall_ms.min(Limits::MAX.wall_ms).max(1),
            fuel: self.fuel.min(Limits::MAX.fuel).max(1),
            memory_bytes: self.memory_bytes.min(Limits::MAX.memory_bytes).max(1024 * 1024),
            output_bytes: self.output_bytes.min(Limits::MAX.output_bytes).max(1024),
        }
    }
}

impl Default for Limits {
    fn default() -> Self {
        Limits {
            wall_ms: 5_000,
            fuel: 1_000_000_000,
            memory_bytes: 128 * 1024 * 1024,
            output_bytes: 256 * 1024,
        }
    }
}

/// What kind of run this is. `Arena` runs are escape attempts against the public Escape Arena and
/// are scored against a host-side canary (see `EscapeOutcome`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunMode {
    Normal,
    Arena,
}

impl Default for RunMode {
    fn default() -> Self {
        RunMode::Normal
    }
}

/// A request as it arrives at the gateway.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub lang: Language,
    pub source: String,
    #[serde(default)]
    pub stdin: String,
    #[serde(default)]
    pub limits: Option<Limits>,
    #[serde(default)]
    pub mode: RunMode,
    /// For Arena runs: a label of the technique the challenger is attempting (e.g. "read /etc/passwd").
    #[serde(default)]
    pub technique: Option<String>,
}

/// A validated job handed to a backend. `canary` is only populated for Arena runs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunJob {
    pub id: String,
    pub lang: Language,
    pub source: String,
    pub stdin: String,
    pub limits: Limits,
    pub mode: RunMode,
    pub technique: Option<String>,
    /// A secret token deliberately placed on the host (outside the sandbox). If a sandboxed program
    /// ever emits it, isolation has genuinely failed. None for normal runs.
    pub canary: Option<String>,
}

/// How a run ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    /// Guest returned from `_start`/exited normally.
    Completed,
    /// Wall-clock deadline tripped (epoch interruption).
    TimedOut,
    /// Memory limit hit on a grow request.
    OutOfMemory,
    /// CPU/fuel budget exhausted.
    CpuExhausted,
    /// A guest trap (panic, unreachable, bad access) that isn't one of the resource limits.
    Trapped,
    /// The sandbox could not be set up (missing runtime, bad module). Not the guest's fault.
    StartupError,
}

/// One entry in the syscall-style trace. These are emitted by the host as it provisions, runs and
/// tears down the sandbox - authentic, host-observed events, not a reconstruction.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEvent {
    /// Monotonic sequence number.
    pub seq: u64,
    /// Milliseconds since the run started.
    pub t_ms: u64,
    /// Short machine-readable kind, e.g. "sandbox.provision", "fd_write", "limit.fuel".
    pub kind: String,
    /// Human-readable detail.
    pub detail: String,
    /// True when this records an action the sandbox *refused* (the interesting ones for security).
    #[serde(default)]
    pub denied: bool,
}

/// Result of scoring an Arena escape attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EscapeOutcome {
    pub technique: String,
    /// True only if the host canary leaked into guest output - a real escape. Should always be false.
    pub succeeded: bool,
    pub notes: String,
}

/// The full result returned to the client. Field names mirror the spec's contract exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub id: String,
    pub backend: String,
    pub lang: Language,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
    pub timed_out: bool,
    pub oom: bool,
    /// True if stdout/stderr were truncated to fit `Limits::output_bytes`.
    pub output_truncated: bool,
    pub outcome: Outcome,
    pub fuel_used: Option<u64>,
    pub trace: Vec<TraceEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub escape: Option<EscapeOutcome>,
}

impl RunResult {
    /// A result for a run that never got off the ground (setup failure).
    pub fn startup_error(id: impl Into<String>, lang: Language, backend: &str, msg: impl Into<String>) -> Self {
        RunResult {
            id: id.into(),
            backend: backend.to_string(),
            lang,
            stdout: String::new(),
            stderr: msg.into(),
            exit_code: None,
            duration_ms: 0,
            timed_out: false,
            oom: false,
            output_truncated: false,
            outcome: Outcome::StartupError,
            fuel_used: None,
            trace: Vec::new(),
            escape: None,
        }
    }
}
