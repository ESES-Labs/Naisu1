use axum::routing::{Router, get};

use crate::state::AppState;

use super::handler;

pub fn strategy_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handler::list_strategies))
        .route("/{id}", get(handler::get_strategy))
}
