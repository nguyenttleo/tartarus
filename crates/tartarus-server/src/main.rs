//! Tartarus CLI / service entrypoint.
//!
//!   tartarus all      gateway + worker in one process (in-memory by default — zero deps)
//!   tartarus serve    gateway only            (needs Redis + Postgres; build --features distributed)
//!   tartarus worker   worker pool only        (needs Redis + Postgres; build --features distributed)
//!   tartarus run      execute one snippet locally and print the result + trace (no HTTP, no queue)

mod api;
mod queue;
mod store;
mod worker;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{bail, Context, Result};
use clap::{Args, Parser, Subcommand};
use tracing_subscriber::EnvFilter;

use tartarus_core::{build_job, Backend, Language, Limits, RunMode, RunRequest, RunResult, WasmBackend};

use api::{AppState, LangInfo};
use queue::{InMemoryQueue, Queue};
use store::{InMemoryStore, Store};
use worker::Worker;

#[cfg(feature = "distributed")]
use queue::RedisQueue;
#[cfg(feature = "distributed")]
use store::PgStore;

#[derive(Parser)]
#[command(name = "tartarus", version, about = "Secure code execution sandbox")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Gateway + worker in one process (in-memory queue/store unless Redis+Postgres are configured).
    All(InfraArgs),
    /// Gateway only (requires Redis + Postgres).
    Serve(InfraArgs),
    /// Worker pool only (requires Redis + Postgres).
    Worker(InfraArgs),
    /// Run a single snippet locally and print the result + trace.
    Run(RunArgs),
}

#[derive(Args, Clone)]
struct InfraArgs {
    #[arg(long, env = "BIND", default_value = "0.0.0.0:8080")]
    bind: String,
    #[arg(long, env = "RUNTIMES_DIR", default_value = "runtimes")]
    runtimes_dir: PathBuf,
    #[arg(long, env = "WORKER_CONCURRENCY", default_value_t = 2)]
    concurrency: usize,
    #[arg(long, env = "REDIS_URL")]
    redis_url: Option<String>,
    #[arg(long, env = "DATABASE_URL")]
    database_url: Option<String>,
}

#[derive(Args)]
struct RunArgs {
    /// Language: python | javascript
    #[arg(long)]
    lang: String,
    /// Path to a source file (or use --code).
    #[arg(long)]
    file: Option<PathBuf>,
    /// Inline source (or use --file).
    #[arg(long)]
    code: Option<String>,
    #[arg(long, env = "RUNTIMES_DIR", default_value = "runtimes")]
    runtimes_dir: PathBuf,
    #[arg(long)]
    stdin: Option<String>,
    #[arg(long)]
    wall_ms: Option<u64>,
    #[arg(long)]
    fuel: Option<u64>,
    #[arg(long)]
    memory_mb: Option<u64>,
    /// Score this run as an Escape Arena attempt against a host canary.
    #[arg(long)]
    arena: bool,
    #[arg(long)]
    technique: Option<String>,
    /// Print the full result as JSON instead of a human summary.
    #[arg(long)]
    json: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    match Cli::parse().cmd {
        Cmd::All(a) => cmd_all(a).await,
        Cmd::Serve(a) => cmd_serve(a).await,
        Cmd::Worker(a) => cmd_worker(a).await,
        Cmd::Run(a) => cmd_run(a).await,
    }
}

fn language_catalog(backend: &WasmBackend) -> Vec<LangInfo> {
    vec![
        LangInfo {
            id: "python".into(),
            label: "Python 3 (CPython · WASI)".into(),
            available: backend.lang_available(Language::Python),
        },
        LangInfo {
            id: "javascript".into(),
            label: "JavaScript (QuickJS · WASI)".into(),
            available: backend.lang_available(Language::Javascript),
        },
    ]
}

/// Build the queue + store pair. Returns `(queue, store, distributed)`.
async fn make_infra(redis_url: Option<&str>, database_url: Option<&str>) -> Result<(Queue, Store, bool)> {
    #[cfg(feature = "distributed")]
    {
        if let (Some(r), Some(d)) = (redis_url, database_url) {
            tracing::info!("distributed mode: Redis queue + Postgres store");
            let queue = Queue::Redis(RedisQueue::new(r, "tartarus:jobs").context("init redis queue")?);
            let store = Store::Postgres(PgStore::connect(d).await.context("connect postgres")?);
            return Ok((queue, store, true));
        }
    }
    #[cfg(not(feature = "distributed"))]
    {
        if redis_url.is_some() || database_url.is_some() {
            tracing::warn!("REDIS_URL/DATABASE_URL set, but this binary was built without `--features distributed`; falling back to in-memory");
        }
    }
    tracing::info!("in-memory mode: no external services required");
    Ok((Queue::InMemory(InMemoryQueue::new()), Store::InMemory(InMemoryStore::default()), false))
}

async fn cmd_all(args: InfraArgs) -> Result<()> {
    let wasm = Arc::new(WasmBackend::new(&args.runtimes_dir).context("init wasm backend")?);
    warn_if_no_runtimes(&wasm);
    let languages = language_catalog(&wasm);
    let (queue, store, _distributed) = make_infra(args.redis_url.as_deref(), args.database_url.as_deref()).await?;

    let backend: Arc<dyn Backend> = wasm.clone();
    Worker::new(queue.clone(), store.clone(), backend).spawn_pool(args.concurrency);

    serve_http(&args.bind, AppState {
        queue,
        store,
        languages,
        max_limits: Limits::MAX,
        started: Instant::now(),
        backend_name: "wasm",
    })
    .await
}

async fn cmd_serve(args: InfraArgs) -> Result<()> {
    let (queue, store, distributed) = make_infra(args.redis_url.as_deref(), args.database_url.as_deref()).await?;
    if !distributed {
        bail!("`serve` needs REDIS_URL + DATABASE_URL and a binary built with `--features distributed`. For local use run `tartarus all`.");
    }
    let wasm = WasmBackend::new(&args.runtimes_dir).context("init wasm backend")?;
    let languages = language_catalog(&wasm);
    serve_http(&args.bind, AppState {
        queue,
        store,
        languages,
        max_limits: Limits::MAX,
        started: Instant::now(),
        backend_name: "wasm",
    })
    .await
}

async fn cmd_worker(args: InfraArgs) -> Result<()> {
    let (queue, store, distributed) = make_infra(args.redis_url.as_deref(), args.database_url.as_deref()).await?;
    if !distributed {
        bail!("`worker` needs REDIS_URL + DATABASE_URL and a binary built with `--features distributed`. For local use run `tartarus all`.");
    }
    let wasm = Arc::new(WasmBackend::new(&args.runtimes_dir).context("init wasm backend")?);
    warn_if_no_runtimes(&wasm);
    let backend: Arc<dyn Backend> = wasm;
    Worker::new(queue, store, backend).spawn_pool(args.concurrency);
    tracing::info!("worker pool running ({} workers); ctrl-c to stop", args.concurrency);
    tokio::signal::ctrl_c().await.context("install ctrl-c handler")?;
    Ok(())
}

async fn cmd_run(args: RunArgs) -> Result<()> {
    let wasm = WasmBackend::new(&args.runtimes_dir).context("init wasm backend")?;
    let lang = Language::from_str(&args.lang)
        .with_context(|| format!("unknown language '{}' (use python|javascript)", args.lang))?;

    let source = match (&args.file, &args.code) {
        (Some(f), _) => std::fs::read_to_string(f).with_context(|| format!("read {}", f.display()))?,
        (None, Some(c)) => c.clone(),
        (None, None) => bail!("provide --file <path> or --code <source>"),
    };

    let mut limits = Limits::default();
    if let Some(w) = args.wall_ms {
        limits.wall_ms = w;
    }
    if let Some(f) = args.fuel {
        limits.fuel = f;
    }
    if let Some(mb) = args.memory_mb {
        limits.memory_bytes = mb * 1024 * 1024;
    }

    let mode = if args.arena { RunMode::Arena } else { RunMode::Normal };
    let req = RunRequest {
        lang,
        source,
        stdin: args.stdin.unwrap_or_default(),
        limits: Some(limits),
        mode,
        technique: args.technique,
    };
    let canary = if args.arena {
        Some(format!("TARTARUS_FLAG{{{}}}", uuid::Uuid::new_v4().simple()))
    } else {
        None
    };

    // Run off the Tokio runtime (see worker.rs): wasmtime-wasi uses block_on internally.
    let job = build_job(req, canary);
    let result = std::thread::spawn(move || wasm.run(&job))
        .join()
        .map_err(|_| anyhow::anyhow!("sandbox thread panicked"))?;
    if args.json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        print_human(&result);
    }
    Ok(())
}

async fn serve_http(bind: &str, state: AppState) -> Result<()> {
    let app = api::router(state);
    let listener = tokio::net::TcpListener::bind(bind).await.with_context(|| format!("bind {bind}"))?;
    tracing::info!("tartarus gateway listening on http://{bind}");
    axum::serve(listener, app).await.context("axum serve")?;
    Ok(())
}

fn warn_if_no_runtimes(backend: &WasmBackend) {
    let any = backend.lang_available(Language::Python) || backend.lang_available(Language::Javascript);
    if !any {
        tracing::warn!(
            "no interpreter runtimes found in {:?} — run runtimes/fetch-runtimes.(sh|ps1) first; \
             the API will report languages as unavailable until then",
            backend.runtimes_dir()
        );
    }
}

fn print_human(r: &RunResult) {
    println!("── tartarus · {} · backend={} · {:?}", r.lang.as_str(), r.backend, r.outcome);
    println!(
        "exit={:?} duration={}ms timedOut={} oom={} truncated={} fuel={:?}",
        r.exit_code, r.duration_ms, r.timed_out, r.oom, r.output_truncated, r.fuel_used
    );
    if !r.stdout.is_empty() {
        println!("\n[stdout]\n{}", r.stdout);
    }
    if !r.stderr.is_empty() {
        println!("\n[stderr]\n{}", r.stderr);
    }
    println!("\n[trace]");
    for e in &r.trace {
        println!(
            "  {:>5}ms {}{} — {}",
            e.t_ms,
            if e.denied { "✗ " } else { "  " },
            e.kind,
            e.detail
        );
    }
    if let Some(esc) = &r.escape {
        println!(
            "\n[arena] technique={} succeeded={} — {}",
            esc.technique, esc.succeeded, esc.notes
        );
    }
}
