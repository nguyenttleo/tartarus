use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub wall_ms: u64,
    pub fuel: u64,
    pub memory_bytes: u64,
    pub output_bytes: u64,
}

impl Limits {
    pub const MAX: Limits = Limits {
        wall_ms: 10_000,
        fuel: 10_000_000_000,
        memory_bytes: 512 * 1024 * 1024,
        output_bytes: 1024 * 1024,
    };

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
    #[serde(default)]
    pub technique: Option<String>,
}

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
    pub canary: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Completed,
    TimedOut,
    OutOfMemory,
    CpuExhausted,
    Trapped,
    StartupError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEvent {
    pub seq: u64,
    pub t_ms: u64,
    pub kind: String,
    pub detail: String,
    #[serde(default)]
    pub denied: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EscapeOutcome {
    pub technique: String,
    pub succeeded: bool,
    pub notes: String,
}

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
    pub output_truncated: bool,
    pub outcome: Outcome,
    pub fuel_used: Option<u64>,
    pub trace: Vec<TraceEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub escape: Option<EscapeOutcome>,
}

impl RunResult {
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
