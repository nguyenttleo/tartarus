//! The stateless gateway: validate, enqueue, and stream results. No code runs here - the gateway
//! never touches a sandbox; it only brokers jobs to the worker pool via the queue/store.

use std::time::{Duration, Instant};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use tartarus_core::{Limits, RunMode, RunRequest};

use crate::labyrinth::{self, LabyrinthState};
use crate::queue::Queue;
use crate::store::Store;

/// Largest source we accept (the gateway rejects anything bigger before it ever enqueues).
const MAX_SOURCE_BYTES: usize = 256 * 1024;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LangInfo {
    pub id: String,
    pub label: String,
    pub available: bool,
}

#[derive(Clone)]
pub struct AppState {
    pub queue: Queue,
    pub store: Store,
    pub labyrinth: LabyrinthState,
    pub languages: Vec<LangInfo>,
    pub max_limits: Limits,
    pub started: Instant,
    pub backend_name: &'static str,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/healthz", get(healthz))
        .route("/languages", get(get_languages))
        .route("/run", post(post_run))
        .route("/run/:id", get(get_run))
        .route("/run/:id/ws", get(ws_run))
        .route("/arena/leaderboard", get(get_leaderboard))
        .nest("/labyrinth", labyrinth::router())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn root() -> impl IntoResponse {
    Json(json!({
        "service": "tartarus",
        "description": "Secure code execution sandbox. POST /run to execute untrusted code.",
        "endpoints": ["/healthz", "/languages", "/run", "/run/:id", "/run/:id/ws", "/arena/leaderboard", "/labyrinth/event", "/labyrinth/teams", "/labyrinth/scoreboard"],
    }))
}

async fn healthz(State(st): State<AppState>) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "backend": st.backend_name,
        "uptimeSeconds": st.started.elapsed().as_secs(),
        "languages": st.languages,
        "maxLimits": st.max_limits,
    }))
}

async fn get_languages(State(st): State<AppState>) -> impl IntoResponse {
    Json(json!({ "languages": st.languages }))
}

async fn post_run(State(st): State<AppState>, Json(req): Json<RunRequest>) -> impl IntoResponse {
    if req.source.len() > MAX_SOURCE_BYTES {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(json!({ "error": format!("source exceeds {MAX_SOURCE_BYTES} bytes") })),
        )
            .into_response();
    }

    let lang_id = req.lang.as_str();
    if !st.languages.iter().any(|l| l.id == lang_id && l.available) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("language '{lang_id}' is not available on this deployment") })),
        )
            .into_response();
    }

    let canary = if req.mode == RunMode::Arena {
        Some(generate_canary())
    } else {
        None
    };
    let job = tartarus_core::build_job(req, canary);
    let id = job.id.clone();

    if let Err(e) = st.queue.enqueue(&job).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("enqueue failed: {e}") })),
        )
            .into_response();
    }

    (
        StatusCode::ACCEPTED,
        Json(json!({ "id": id, "status": "queued" })),
    )
        .into_response()
}

async fn get_run(State(st): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    match st.store.get_result(&id).await {
        Ok(Some(result)) => Json(json!({ "status": "done", "result": result })).into_response(),
        Ok(None) => Json(json!({ "status": "pending" })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn ws_run(
    ws: WebSocketUpgrade,
    State(st): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_loop(socket, st, id))
}

/// Poll the store and push status frames until the result lands (or we give up). Trace + output
/// arrive together in the final `done` frame.
async fn ws_loop(mut socket: WebSocket, st: AppState, id: String) {
    // ~36s ceiling at 150ms cadence - comfortably above the 10s max wall-clock.
    for _ in 0..240u32 {
        match st.store.get_result(&id).await {
            Ok(Some(result)) => {
                let frame = serde_json::to_string(&json!({ "status": "done", "result": result }))
                    .unwrap_or_else(|_| "{\"status\":\"error\"}".to_string());
                let _ = socket.send(Message::Text(frame)).await;
                let _ = socket.close().await;
                return;
            }
            Ok(None) => {
                if socket
                    .send(Message::Text(json!({ "status": "pending" }).to_string()))
                    .await
                    .is_err()
                {
                    return; // client went away
                }
            }
            Err(_) => {
                let _ = socket
                    .send(Message::Text(json!({ "status": "error" }).to_string()))
                    .await;
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
    let _ = socket
        .send(Message::Text(json!({ "status": "timeout" }).to_string()))
        .await;
}

async fn get_leaderboard(State(st): State<AppState>) -> impl IntoResponse {
    match st.store.leaderboard().await {
        Ok(summary) => Json(summary).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

/// A per-run secret placed only on the host (never handed to the sandbox). If it ever appears in
/// guest output, isolation has genuinely failed.
fn generate_canary() -> String {
    format!("TARTARUS_FLAG{{{}}}", Uuid::new_v4().simple())
}
