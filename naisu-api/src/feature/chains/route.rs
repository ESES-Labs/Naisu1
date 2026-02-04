use axum::routing::{Router, get};

use crate::state::AppState;

use super::handler;

pub fn chain_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handler::list_chains))
        .route("/status", get(handler::get_chain_status))
}
