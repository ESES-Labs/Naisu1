use axum::routing::{Router, get};

use crate::state::AppState;

use super::handler;

pub fn intent_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handler::list_intents).post(handler::create_intent))
        .route("/{id}", get(handler::get_intent))
        .route("/{id}/status", get(handler::get_intent_status))
        .route("/user/{address}", get(handler::list_user_intents))
}
