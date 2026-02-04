use axum::routing::{Router, get, post};

use crate::state::AppState;

use super::handler;

pub fn ai_routes() -> Router<AppState> {
    Router::new()
        .route("/chat", post(handler::chat))
        .route("/health", get(handler::ai_health_check))
}
