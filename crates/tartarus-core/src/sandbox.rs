//! The WASM/WASI isolation backend - the part that actually runs hostile code safely.
//!
//! Defense in depth, all enforced here:
//!   * **No network**: WASI preview1 grants no socket-opening capability at all.
//!   * **No host filesystem**: only a per-run, read-only `/sandbox` (the source) and a small
//!     writable `/tmp` are preopened; nothing else on the host is reachable.
//!   * **No environment / no ambient authority**: empty env, argv is just the interpreter + script.
//!   * **CPU cap**: wasmtime *fuel* metering traps the guest when its instruction budget runs out.
//!   * **Wall-clock cap**: *epoch interruption* driven by a background ticker traps a hung guest.
//!   * **Memory cap**: a `ResourceLimiter` refuses `memory.grow` past the limit and flags OOM.
//!   * **Output cap**: stdout/stderr are captured into fixed-capacity pipes and flagged if filled.
//!   * **Ephemeral**: a fresh `Store` per run; the temp dir is deleted on the way out.
//!
//! Everything wasmtime-specific lives in this file. Pinned to wasmtime 27.x; on a version bump this
//! is the only module that should need touching.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use wasmtime::{Config, Engine, Linker, Module, ResourceLimiter, Store, Trap};
use wasmtime_wasi::pipe::{MemoryInputPipe, MemoryOutputPipe};
use wasmtime_wasi::preview1::{self, WasiP1Ctx};
use wasmtime_wasi::{DirPerms, FilePerms, I32Exit, WasiCtxBuilder};

use crate::backend::Backend;
use crate::lang::{GUEST_SOURCE_DIR, GUEST_TMP_DIR};
use crate::trace::Tracer;
use crate::types::{EscapeOutcome, Language, Limits, Outcome, RunJob, RunMode, RunResult};

/// How often the background ticker advances the engine epoch. Wall-clock granularity.
const EPOCH_TICK_MS: u64 = 10;

/// Per-`Store` host state: the WASI context plus our memory limiter.
struct HostState {
    wasi: WasiP1Ctx,
    limiter: MemLimiter,
}

/// Caps linear-memory growth and records the moment a guest hits the ceiling.
struct MemLimiter {
    max_memory: usize,
    oom_hit: bool,
    tracer: Tracer,
}

impl ResourceLimiter for MemLimiter {
    fn memory_growing(&mut self, current: usize, desired: usize, _maximum: Option<usize>) -> Result<bool> {
        if desired > self.max_memory {
            if !self.oom_hit {
                self.tracer.denied(
                    "limit.memory",
                    format!("memory.grow {current}->{desired}B exceeds cap {}B", self.max_memory),
                );
            }
            self.oom_hit = true;
            Ok(false) // deny the growth; the guest sees the allocation fail
        } else {
            Ok(true)
        }
    }

    fn table_growing(&mut self, _current: usize, _desired: usize, _maximum: Option<usize>) -> Result<bool> {
        Ok(true)
    }
}

/// The WASM/WASI backend. Holds one shared `Engine` (with a single epoch ticker) and a cache of
/// compiled interpreter modules.
pub struct WasmBackend {
    engine: Engine,
    runtimes_dir: PathBuf,
    modules: Mutex<HashMap<&'static str, (Module, usize)>>,
}

impl WasmBackend {
    pub fn new(runtimes_dir: impl Into<PathBuf>) -> Result<Self> {
        let mut config = Config::new();
        config.consume_fuel(true);
        config.epoch_interruption(true);
        let engine = Engine::new(&config).context("create wasmtime engine")?;

        // One ticker for the whole engine drives every run's wall-clock deadline.
        let eng = engine.clone();
        let _ticker = thread::Builder::new()
            .name("tartarus-epoch".into())
            .spawn(move || loop {
                thread::sleep(Duration::from_millis(EPOCH_TICK_MS));
                eng.increment_epoch();
            })
            .context("spawn epoch ticker")?;

        Ok(WasmBackend {
            engine,
            runtimes_dir: runtimes_dir.into(),
            modules: Mutex::new(HashMap::new()),
        })
    }

    /// True if this language's interpreter wasm is present on disk (used for health + test skips).
    pub fn lang_available(&self, lang: Language) -> bool {
        lang.wasm_path(&self.runtimes_dir).is_file()
    }

    pub fn runtimes_dir(&self) -> &Path {
        &self.runtimes_dir
    }

    /// Compile (once) and cache the interpreter module for a language.
    fn module_for(&self, lang: Language) -> Result<(Module, usize)> {
        let key = lang.runtime().wasm_file;
        if let Some(found) = self.modules.lock().unwrap().get(key) {
            return Ok(found.clone());
        }
        let path = lang.wasm_path(&self.runtimes_dir);
        let bytes = fs::read(&path)
            .with_context(|| format!("read interpreter {} (run runtimes/fetch-runtimes first)", path.display()))?;
        let module = Module::new(&self.engine, &bytes).with_context(|| format!("compile {}", path.display()))?;
        let entry = (module, bytes.len());
        self.modules.lock().unwrap().insert(key, entry.clone());
        Ok(entry)
    }

    /// The fallible core; `Err` means the sandbox could not even be set up (host's fault). A guest
    /// trap, timeout or OOM is a normal `Ok(result)`.
    fn try_run(&self, job: &RunJob) -> Result<RunResult> {
        let tracer = Tracer::new();
        let limits = job.limits.clamped();
        tracer.event(
            "sandbox.provision",
            format!(
                "backend=wasm lang={} wall={}ms fuel={} mem={}B out={}B",
                job.lang.as_str(),
                limits.wall_ms,
                limits.fuel,
                limits.memory_bytes,
                limits.output_bytes
            ),
        );

        // Per-run throwaway directory tree on the host.
        let base = std::env::temp_dir().join("tartarus").join(&job.id);
        let sandbox_dir = base.join("sandbox");
        let tmp_dir = base.join("tmp");
        fs::create_dir_all(&sandbox_dir).context("create sandbox dir")?;
        fs::create_dir_all(&tmp_dir).context("create tmp dir")?;
        let _guard = DirGuard(base.clone());

        let src_path = sandbox_dir.join(job.lang.runtime().source_file);
        fs::write(&src_path, job.source.as_bytes()).context("stage source")?;
        tracer.event(
            "fs.stage",
            format!("wrote {} bytes to {}", job.source.len(), job.lang.guest_source_path()),
        );

        let (module, module_len) = self.module_for(job.lang)?;
        tracer.event("module.load", format!("{} ({module_len} bytes) compiled", job.lang.runtime().wasm_file));

        // Capture pipes. Fixed capacity == output cap; filling one flags truncation.
        let out_cap = limits.output_bytes as usize;
        let stdin_pipe = MemoryInputPipe::new(job.stdin.clone().into_bytes());
        let stdout_pipe = MemoryOutputPipe::new(out_cap);
        let stderr_pipe = MemoryOutputPipe::new(out_cap);

        // The locked-down WASI context.
        let mut builder = WasiCtxBuilder::new();
        builder.stdin(stdin_pipe);
        builder.stdout(stdout_pipe.clone());
        builder.stderr(stderr_pipe.clone());
        for a in job.lang.argv() {
            builder.arg(a);
        }
        builder
            .preopened_dir(&sandbox_dir, GUEST_SOURCE_DIR, DirPerms::READ, FilePerms::READ)
            .context("preopen /sandbox")?;
        builder
            .preopened_dir(&tmp_dir, GUEST_TMP_DIR, DirPerms::all(), FilePerms::all())
            .context("preopen /tmp")?;
        let wasi = builder.build_p1();
        tracer.event("wasi.configure", "env=none net=none; preopen /sandbox(ro) /tmp(rw)");
        tracer.event("net.policy", "no socket capability granted (WASI preview1 cannot open connections)");

        let host = HostState {
            wasi,
            limiter: MemLimiter {
                max_memory: limits.memory_bytes as usize,
                oom_hit: false,
                tracer: tracer.clone(),
            },
        };
        let mut store = Store::new(&self.engine, host);
        store.limiter(|s| &mut s.limiter);
        store.set_fuel(limits.fuel).context("set fuel")?;
        let ticks = limits.wall_ms.div_ceil(EPOCH_TICK_MS).max(1);
        store.set_epoch_deadline(ticks);

        let mut linker: Linker<HostState> = Linker::new(&self.engine);
        preview1::add_to_linker_sync(&mut linker, |s: &mut HostState| &mut s.wasi)
            .context("link wasi preview1")?;

        tracer.event("guest.start", format!("instantiate + call _start (argv {:?})", job.lang.argv()));
        let started = Instant::now();
        let instance = linker.instantiate(&mut store, &module).context("instantiate guest")?;
        let start_func = instance
            .get_typed_func::<(), ()>(&mut store, "_start")
            .context("guest is missing _start (not a WASI command module)")?;
        let call = start_func.call(&mut store, ());
        let duration_ms = started.elapsed().as_millis() as u64;

        let fuel_used = limits.fuel.saturating_sub(store.get_fuel().unwrap_or(0));
        let oom_hit = store.data().limiter.oom_hit;

        let (outcome, exit_code, extra_err) = match call {
            Ok(()) => (Outcome::Completed, Some(0), None),
            Err(e) => classify_error(&e, oom_hit),
        };

        // Collect captured output.
        let stdout_bytes = stdout_pipe.contents();
        let stderr_bytes = stderr_pipe.contents();
        let stdout_trunc = stdout_bytes.len() >= out_cap;
        let stderr_trunc = stderr_bytes.len() >= out_cap;
        let stdout = String::from_utf8_lossy(&stdout_bytes).into_owned();
        let mut stderr = String::from_utf8_lossy(&stderr_bytes).into_owned();
        if let Some(err) = extra_err {
            if !stderr.is_empty() {
                stderr.push('\n');
            }
            stderr.push_str(&err);
        }

        if !stdout_bytes.is_empty() {
            tracer.event(
                "fd_write",
                format!("stdout {} bytes{}", stdout_bytes.len(), if stdout_trunc { " (truncated)" } else { "" }),
            );
        }
        if !stderr_bytes.is_empty() {
            tracer.event(
                "fd_write",
                format!("stderr {} bytes{}", stderr_bytes.len(), if stderr_trunc { " (truncated)" } else { "" }),
            );
        }
        match outcome {
            Outcome::TimedOut => tracer.denied(
                "limit.wallclock",
                format!("guest killed after ~{duration_ms}ms (cap {}ms)", limits.wall_ms),
            ),
            Outcome::CpuExhausted => {
                tracer.denied("limit.fuel", format!("CPU/fuel budget exhausted ({fuel_used} units)"))
            }
            _ => {}
        }
        tracer.event(
            "guest.exit",
            format!("outcome={outcome:?} exit={exit_code:?} fuel_used={fuel_used} dur={duration_ms}ms"),
        );

        let timed_out = outcome == Outcome::TimedOut;
        let oom = outcome == Outcome::OutOfMemory || oom_hit;

        // Escape Arena scoring: did the host canary leak into guest output? (It never should.)
        let escape = if job.mode == RunMode::Arena {
            let succeeded = match &job.canary {
                Some(c) => stdout.contains(c.as_str()) || stderr.contains(c.as_str()),
                None => false,
            };
            let technique = job.technique.clone().unwrap_or_else(|| "unspecified".to_string());
            if succeeded {
                tracer.denied("escape.success", format!("canary leaked via output (technique: {technique})"));
            } else {
                tracer.event("escape.contained", format!("attempt contained (technique: {technique})"));
            }
            Some(EscapeOutcome {
                technique,
                succeeded,
                notes: if succeeded {
                    "Host canary observed in guest output - isolation breach".to_string()
                } else {
                    "No host canary in output; attempt contained".to_string()
                },
            })
        } else {
            None
        };

        Ok(RunResult {
            id: job.id.clone(),
            backend: "wasm".to_string(),
            lang: job.lang,
            stdout,
            stderr,
            exit_code,
            duration_ms,
            timed_out,
            oom,
            output_truncated: stdout_trunc || stderr_trunc,
            outcome,
            fuel_used: Some(fuel_used),
            trace: tracer.drain(),
            escape,
        })
    }
}

impl Backend for WasmBackend {
    fn name(&self) -> &'static str {
        "wasm"
    }

    fn run(&self, job: &RunJob) -> RunResult {
        match self.try_run(job) {
            Ok(r) => r,
            Err(e) => {
                RunResult::startup_error(job.id.clone(), job.lang, self.name(), format!("sandbox setup failed: {e:#}"))
            }
        }
    }
}

/// Map a guest error to (outcome, exit_code, extra_stderr).
fn classify_error(e: &anyhow::Error, oom_hit: bool) -> (Outcome, Option<i32>, Option<String>) {
    // A clean WASI exit (incl. non-zero) arrives as an `I32Exit`.
    if let Some(exit) = e.downcast_ref::<I32Exit>() {
        return (Outcome::Completed, Some(exit.0), None);
    }
    if let Some(trap) = e.downcast_ref::<Trap>() {
        match trap {
            Trap::Interrupt => return (Outcome::TimedOut, None, None),
            Trap::OutOfFuel => return (Outcome::CpuExhausted, None, None),
            _ => {}
        }
    }
    if oom_hit {
        return (Outcome::OutOfMemory, None, None);
    }
    (Outcome::Trapped, None, Some(format!("{e:#}")))
}

/// Deletes the per-run temp tree when the run ends, however it ends.
struct DirGuard(PathBuf);

impl Drop for DirGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Default per-deployment limits (re-exported for the server's clamping defaults).
pub fn default_limits() -> Limits {
    Limits::default()
}
