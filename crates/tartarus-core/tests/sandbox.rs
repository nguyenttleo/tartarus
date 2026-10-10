use std::path::PathBuf;

use tartarus_core::types::{Language, Limits, RunMode, RunRequest};
use tartarus_core::{build_job, Backend, Outcome, RunResult, WasmBackend};

fn runtimes_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../runtimes")
}

fn backend() -> WasmBackend {
    WasmBackend::new(runtimes_dir()).expect("create wasm backend")
}

fn run(lang: Language, source: &str, stdin: &str, limits: Limits, mode: RunMode) -> RunResult {
    let be = backend();
    let req = RunRequest {
        lang,
        source: source.to_string(),
        stdin: stdin.to_string(),
        limits: Some(limits),
        mode,
        technique: Some("test".to_string()),
    };
    let canary = Some("TARTARUS_CANARY_8f3a91c2".to_string());
    be.run(&build_job(req, canary))
}

macro_rules! require_lang {
    ($lang:expr) => {{
        let be = backend();
        if !be.lang_available($lang) {
            eprintln!("skipping: {} runtime not found in {:?}", $lang.as_str(), runtimes_dir());
            return;
        }
    }};
}

#[test]
fn python_hello_world() {
    require_lang!(Language::Python);
    let r = run(Language::Python, "print('hello from python')", "", Limits::default(), RunMode::Normal);
    assert_eq!(r.outcome, Outcome::Completed, "stderr: {}", r.stderr);
    assert!(r.stdout.contains("hello from python"), "stdout was: {:?}", r.stdout);
    assert_eq!(r.exit_code, Some(0));
}

#[test]
fn javascript_hello_world() {
    require_lang!(Language::Javascript);
    let r = run(Language::Javascript, "console.log('hello from js')", "", Limits::default(), RunMode::Normal);
    assert_eq!(r.outcome, Outcome::Completed, "stderr: {}", r.stderr);
    assert!(r.stdout.contains("hello from js"), "stdout was: {:?}", r.stdout);
}

#[test]
fn stdin_is_piped() {
    require_lang!(Language::Python);
    let r = run(
        Language::Python,
        "import sys; print(sys.stdin.readline().strip().upper())",
        "quiet please\n",
        Limits::default(),
        RunMode::Normal,
    );
    assert!(r.stdout.contains("QUIET PLEASE"), "stdout was: {:?}", r.stdout);
}

#[test]
fn cpu_spin_is_stopped() {
    require_lang!(Language::Python);
    let limits = Limits { wall_ms: 1500, fuel: 200_000_000, ..Limits::default() };
    let r = run(Language::Python, "while True:\n    pass", "", limits, RunMode::Normal);
    assert!(
        matches!(r.outcome, Outcome::CpuExhausted | Outcome::TimedOut),
        "expected the spin to be stopped, got {:?} (stderr {})",
        r.outcome,
        r.stderr
    );
}

#[test]
fn memory_bomb_is_capped() {
    require_lang!(Language::Python);
    let limits = Limits { memory_bytes: 128 * 1024 * 1024, ..Limits::default() };
    let src = r#"
chunks = []
try:
    while True:
        chunks.append(bytearray(16 * 1024 * 1024))
except MemoryError:
    print('memory error after', len(chunks) * 16, 'MB')
"#;
    let r = run(Language::Python, src, "", limits, RunMode::Normal);
    assert!(r.oom, "expected the memory cap to be hit, outcome {:?} stderr {}", r.outcome, r.stderr);
}

#[test]
fn output_flood_is_truncated() {
    require_lang!(Language::Python);
    let limits = Limits { output_bytes: 2048, ..Limits::default() };
    let r = run(Language::Python, "print('A' * 1_000_000)", "", limits, RunMode::Normal);
    assert!(r.output_truncated, "expected truncation, outcome {:?}", r.outcome);
    assert!(r.stdout.len() <= 2048 + 16);
}

#[test]
fn host_filesystem_is_unreachable() {
    require_lang!(Language::Python);
    let src = r#"
try:
    print(open('/etc/passwd').read())
except Exception as e:
    print('blocked:', type(e).__name__)
"#;
    let r = run(Language::Python, src, "", Limits::default(), RunMode::Arena);
    let esc = r.escape.expect("arena run should be scored");
    assert!(!esc.succeeded, "host filesystem must stay unreachable");
    assert!(!r.stdout.contains("root:"), "leaked /etc/passwd contents: {:?}", r.stdout);
}

#[test]
fn missing_runtime_is_a_clean_startup_error() {
    let be = WasmBackend::new(std::env::temp_dir().join("tartarus-nonexistent-runtimes")).unwrap();
    let req = RunRequest {
        lang: Language::Python,
        source: "print(1)".into(),
        stdin: String::new(),
        limits: None,
        mode: RunMode::Normal,
        technique: None,
    };
    let r = be.run(&build_job(req, None));
    assert_eq!(r.outcome, Outcome::StartupError);
}
