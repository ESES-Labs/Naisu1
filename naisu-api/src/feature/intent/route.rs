//! Intent Routes

use axum::{
    routing::{get},
    Router,
};

use crate::state::AppState;
use super::handler;

/// Create intent routes
pub fn intent_routes() -> Router<AppState> {
    Router::new()
        .route("/intents", get(handler::list_intents))
        .route("/intents/stats", get(handler::get_stats))
        .route("/intents/:id", get(handler::get_intent))
        .route("/intents/:id/bids", get(handler::get_intent_bids))
}
