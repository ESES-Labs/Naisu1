use axum::routing::{Router, get};

use crate::state::AppState;

use super::handler;

pub fn health_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handler::public_health_check))
        .route("/detailed", get(handler::detailed_health_check))
}
