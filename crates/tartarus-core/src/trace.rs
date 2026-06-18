//! A small, thread-safe trace collector. The sandbox shares a `Tracer` and records authentic,
//! host-observed events as it provisions, runs and tears down a guest.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::types::TraceEvent;

#[derive(Clone)]
pub struct Tracer {
    inner: Arc<Mutex<Inner>>,
    start: Instant,
}

struct Inner {
    seq: u64,
    events: Vec<TraceEvent>,
}

impl Tracer {
    pub fn new() -> Self {
        Tracer {
            inner: Arc::new(Mutex::new(Inner { seq: 0, events: Vec::new() })),
            start: Instant::now(),
        }
    }

    fn push(&self, kind: &str, detail: String, denied: bool) {
        let t_ms = self.start.elapsed().as_millis() as u64;
        let mut g = self.inner.lock().expect("tracer poisoned");
        let seq = g.seq;
        g.seq += 1;
        g.events.push(TraceEvent { seq, t_ms, kind: kind.to_string(), detail, denied });
    }

    /// Record an allowed/observed event.
    pub fn event(&self, kind: &str, detail: impl Into<String>) {
        self.push(kind, detail.into(), false);
    }

    /// Record an action the sandbox refused — the ones that matter for the security story.
    pub fn denied(&self, kind: &str, detail: impl Into<String>) {
        self.push(kind, detail.into(), true);
    }

    /// Drain the collected events in order.
    pub fn drain(&self) -> Vec<TraceEvent> {
        let mut g = self.inner.lock().expect("tracer poisoned");
        std::mem::take(&mut g.events)
    }
}

impl Default for Tracer {
    fn default() -> Self {
        Tracer::new()
    }
}
