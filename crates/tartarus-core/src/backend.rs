use crate::types::{RunJob, RunResult};

pub trait Backend: Send + Sync {
    fn name(&self) -> &'static str;

    fn run(&self, job: &RunJob) -> RunResult;
}

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
