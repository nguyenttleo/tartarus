//! Job queue. In-memory by default (zero dependencies); a Redis list in `distributed` builds.
//!
//! Modelled as an enum rather than a `dyn` trait so the async methods stay simple and monomorphic.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use anyhow::Result;
use tartarus_core::RunJob;
use tokio::sync::Notify;

#[derive(Clone)]
pub enum Queue {
    InMemory(InMemoryQueue),
    #[cfg(feature = "distributed")]
    Redis(RedisQueue),
}

impl Queue {
    pub async fn enqueue(&self, job: &RunJob) -> Result<()> {
        match self {
            Queue::InMemory(q) => q.enqueue(job.clone()),
            #[cfg(feature = "distributed")]
            Queue::Redis(q) => q.enqueue(job).await,
        }
    }

    /// Returns the next job, waiting if necessary. `Ok(None)` means "nothing yet, ask again"
    /// (used by the Redis backend's blocking-pop timeout); callers should simply loop.
    pub async fn dequeue(&self) -> Result<Option<RunJob>> {
        match self {
            Queue::InMemory(q) => Ok(Some(q.dequeue().await)),
            #[cfg(feature = "distributed")]
            Queue::Redis(q) => q.dequeue().await,
        }
    }
}

/// A simple async FIFO. `Notify` carries one permit, so an enqueue that races an idle worker is
/// not lost; the pre-check before awaiting drains any backlog.
#[derive(Clone)]
pub struct InMemoryQueue {
    inner: Arc<Mutex<VecDeque<RunJob>>>,
    notify: Arc<Notify>,
}

impl InMemoryQueue {
    pub fn new() -> Self {
        InMemoryQueue {
            inner: Arc::new(Mutex::new(VecDeque::new())),
            notify: Arc::new(Notify::new()),
        }
    }

    pub fn enqueue(&self, job: RunJob) -> Result<()> {
        self.inner.lock().unwrap().push_back(job);
        self.notify.notify_one();
        Ok(())
    }

    pub async fn dequeue(&self) -> RunJob {
        loop {
            if let Some(job) = self.inner.lock().unwrap().pop_front() {
                return job;
            }
            self.notify.notified().await;
        }
    }
}

impl Default for InMemoryQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(feature = "distributed")]
#[derive(Clone)]
pub struct RedisQueue {
    client: redis::Client,
    key: String,
}

#[cfg(feature = "distributed")]
impl RedisQueue {
    pub fn new(url: &str, key: impl Into<String>) -> Result<Self> {
        Ok(RedisQueue {
            client: redis::Client::open(url)?,
            key: key.into(),
        })
    }

    pub async fn enqueue(&self, job: &RunJob) -> Result<()> {
        use redis::AsyncCommands;
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let payload = serde_json::to_string(job)?;
        let _: () = conn.rpush(&self.key, payload).await?;
        Ok(())
    }

    pub async fn dequeue(&self) -> Result<Option<RunJob>> {
        use redis::AsyncCommands;
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        // BLPOP returns [key, value] or nil after the timeout.
        let res: Option<(String, String)> = conn.blpop(&self.key, 5.0).await?;
        match res {
            Some((_, payload)) => Ok(Some(serde_json::from_str(&payload)?)),
            None => Ok(None),
        }
    }
}
