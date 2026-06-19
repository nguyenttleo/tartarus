//! The isolation backend abstraction. The whole point of Tartarus is that the *contract* -
//! "run this job under these limits, give me output + a trace" - is identical no matter how the
//! isolation is actually achieved. v1 ships `WasmBackend`; gVisor and Firecracker plug in behind
//! the same trait on a Linux/KVM host.

use crate::types::{RunJob, RunResult};

/// A unit of isolation. Implementations are synchronous and CPU-bound; callers run them on a
/// blocking thread (e.g. `tokio::task::spawn_blocking`).
pub trait Backend: Send + Sync {
    /// Stable identifier reported in results and metrics ("wasm", "gvisor", "firecracker").
    fn name(&self) -> &'static str;

    /// Execute one job in a throwaway sandbox and return the result. Implementations MUST NOT panic
    /// on hostile input - a guest trap, timeout or OOM is a normal, reportable outcome.
    fn run(&self, job: &RunJob) -> RunResult;
}

/// gVisor (`runsc`) backend - a userspace kernel that intercepts guest syscalls. Strong isolation
/// for arbitrary native binaries / any language, without a full VM.
///
/// Not built in v1: `runsc` requires a Linux host and is not installable in this dev/CI
/// environment. The deploy guide (`deploy/HOSTING.md`) covers standing it up on a Linux box; once
/// present, this is where the `runsc` invocation, cgroup setup and stdout/stderr/trace capture go.
/// It is a feature-gated stub so the trait and the rest of the system can be wired and tested
/// today, and lit up later by implementing `run`.
pub struct GvisorBackend;

impl Backend for GvisorBackend {
    fn name(&self) -> &'static str {
        "gvisor"
    }

    fn run(&self, job: &RunJob) -> RunResult {
        RunResult::startup_error(
            job.id.clone(),
            job.lang,
            self.name(),
            "gVisor backend is not enabled in this build (requires a Linux host with runsc). \
             See deploy/HOSTING.md.",
        )
    }
}

/// Firecracker microVM backend - KVM microVMs (~125 ms boot), the strongest isolation tier.
///
/// Not built in v1: Firecracker needs bare-metal / nested-KVM, which this environment and most
/// PaaS tiers don't provide. Notably, when Tartarus is deployed on Fly.io the *whole service*
/// already runs inside a Firecracker microVM, so the WASM backend inherits microVM isolation for
/// free; this dedicated per-run microVM backend is the v3 upgrade for hostile-binary workloads.
pub struct FirecrackerBackend;

impl Backend for FirecrackerBackend {
    fn name(&self) -> &'static str {
        "firecracker"
    }

    fn run(&self, job: &RunJob) -> RunResult {
        RunResult::startup_error(
            job.id.clone(),
            job.lang,
            self.name(),
            "Firecracker backend is not enabled in this build (requires KVM). See deploy/HOSTING.md.",
        )
    }
}
