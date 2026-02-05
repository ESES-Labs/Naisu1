use axum::routing::{get, post};
use axum::Router;

use crate::state::AppState;

use super::handler;

pub fn solver_routes() -> Router<AppState> {
    Router::new()
        .route("/bids", post(handler::post_bid))
        .route("/bids/{intent_id}", get(handler::get_bids))
}
