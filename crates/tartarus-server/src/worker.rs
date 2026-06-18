//! The worker: pull a job, run it in a throwaway sandbox on a blocking thread, persist the result
//! (and any escape attempt), repeat. Workers are independent; run as many as you have cores.

use std::sync::Arc;
use std::time::Duration;

use tartarus_core::Backend;
use uuid::Uuid;

use crate::queue::Queue;
use crate::store::{now_unix, EscapeRecord, Store};

pub struct Worker {
    queue: Queue,
    store: Store,
    backend: Arc<dyn Backend>,
}

impl Worker {
    pub fn new(queue: Queue, store: Store, backend: Arc<dyn Backend>) -> Self {
        Worker { queue, store, backend }
    }

    /// Spawn `n` worker loops onto the Tokio runtime.
    pub fn spawn_pool(self, n: usize) {
        let shared = Arc::new(self);
        for i in 0..n.max(1) {
            let w = shared.clone();
            tokio::spawn(async move {
                tracing::info!("worker {i} online");
                w.run_loop().await;
            });
        }
    }

    async fn run_loop(self: Arc<Self>) {
        loop {
            let job = match self.queue.dequeue().await {
                Ok(Some(job)) => job,
                Ok(None) => continue, // queue timeout (Redis); just poll again
                Err(e) => {
                    tracing::error!("dequeue failed: {e:#}");
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    continue;
                }
            };

            let backend = self.backend.clone();
            let job_id = job.id.clone();
            // Run the sandbox on a plain OS thread, NOT a Tokio worker/blocking thread: wasmtime-wasi's
            // synchronous WASI calls `block_on` internally, which panics inside a Tokio runtime context.
            let (tx, rx) = tokio::sync::oneshot::channel();
            std::thread::spawn(move || {
                let _ = tx.send(backend.run(&job));
            });

            match rx.await {
                Ok(res) => {
                    if let Some(esc) = &res.escape {
                        let rec = EscapeRecord {
                            id: Uuid::new_v4().to_string(),
                            run_id: res.id.clone(),
                            technique: esc.technique.clone(),
                            succeeded: esc.succeeded,
                            notes: esc.notes.clone(),
                            lang: res.lang.as_str().to_string(),
                            created_at_unix: now_unix(),
                        };
                        if esc.succeeded {
                            // The single alert that matters: a guest broke containment.
                            tracing::error!(run = %res.id, technique = %esc.technique, "ESCAPE SUCCEEDED — paging");
                        }
                        if let Err(e) = self.store.record_escape(&rec).await {
                            tracing::error!("record_escape failed: {e:#}");
                        }
                    }
                    if let Err(e) = self.store.save_result(&res).await {
                        tracing::error!("save_result failed for {}: {e:#}", res.id);
                    }
                }
                Err(_) => {
                    tracing::error!("worker sandbox thread for {job_id} panicked before returning a result");
                }
            }
        }
    }
}
